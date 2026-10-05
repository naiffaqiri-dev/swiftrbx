import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

type VapidKeys = { public_key: string; private_key: string }

type StoredSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

async function getVapidKeys(): Promise<VapidKeys> {
  const admin = createAdminClient()
  const { data: existing, error: readError } = await admin
    .from('push_vapid_keys')
    .select('public_key, private_key')
    .eq('id', 1)
    .maybeSingle()

  if (readError) throw readError
  if (existing) return existing

  const generated = webpush.generateVAPIDKeys()
  const { error: insertError } = await admin.from('push_vapid_keys').upsert(
    { id: 1, public_key: generated.publicKey, private_key: generated.privateKey },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (insertError) throw insertError

  const { data: saved, error: savedError } = await admin
    .from('push_vapid_keys')
    .select('public_key, private_key')
    .eq('id', 1)
    .single()

  if (savedError || !saved) throw savedError ?? new Error('Unable to initialize Web Push keys')
  return saved
}

export async function getPushPublicKey() {
  return (await getVapidKeys()).public_key
}

export async function sendTicketMessagePush(senderId: string, ticketId: string, messageId: string) {
  const admin = createAdminClient()
  const [{ data: ticket }, { data: message }] = await Promise.all([
    admin.from('tickets').select('id, buyer_id, seller_id').eq('id', ticketId).maybeSingle(),
    admin.from('ticket_messages').select('id, sender_id').eq('id', messageId).eq('ticket_id', ticketId).maybeSingle(),
  ])

  if (!ticket || !message || message.sender_id !== senderId) return

  const recipientId = ticket.buyer_id === senderId ? ticket.seller_id : ticket.seller_id === senderId ? ticket.buyer_id : null
  if (!recipientId) return

  const keys = await getVapidKeys()
  webpush.setVapidDetails('mailto:notifications@swiftrbx.site', keys.public_key, keys.private_key)

  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', recipientId)
  if (error) throw error

  const payload = JSON.stringify({
    title: 'رسالة جديدة في التذكرة',
    body: 'لديك رسالة جديدة من الطرف الآخر.',
    url: `/tickets/${encodeURIComponent(ticketId)}`,
    tag: `ticket-${ticketId}`,
  })

  await Promise.all(
    ((subscriptions ?? []) as StoredSubscription[]).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        )
      } catch (cause) {
        const statusCode = (cause as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', subscription.id)
          return
        }
        throw cause
      }
    }),
  )
}

export function isValidPushSubscription(value: unknown): value is {
  endpoint: string
  keys: { p256dh: string; auth: string }
} {
  if (!value || typeof value !== 'object') return false
  const subscription = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  if (typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 4096) return false
  if (typeof subscription.keys?.p256dh !== 'string' || typeof subscription.keys?.auth !== 'string') return false
  try {
    return new URL(subscription.endpoint).protocol === 'https:'
  } catch {
    return false
  }
}

export function getPushKeys(value: { keys: { p256dh: string; auth: string } }) {
  return { p256dh: value.keys.p256dh, auth: value.keys.auth }
}

export function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

export async function savePushSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!response.ok) throw new Error('Unable to save push subscription')
}

export async function enableBrowserPush() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('unsupported')
  }

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'blocked' : 'dismissed')

  const registration = await navigator.serviceWorker.register('/sw.js')
  const keyResponse = await fetch('/api/push-subscriptions', { cache: 'no-store' })
  const keyData = await keyResponse.json().catch(() => ({}))
  if (!keyResponse.ok || typeof keyData.publicKey !== 'string') throw new Error('server')

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(keyData.publicKey),
    }))
  await savePushSubscription(subscription)
  return subscription
}

export async function disableBrowserPush() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const response = await fetch('/api/push-subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  if (!response.ok) throw new Error('Unable to remove push subscription')
  await subscription.unsubscribe()
}

export async function hasBrowserPushSubscription() {
  if (!('serviceWorker' in navigator)) return false
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  return Boolean(subscription)
}

export async function syncBrowserPushSubscription() {
  if (!('serviceWorker' in navigator)) return false
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return false
  await savePushSubscription(subscription)
  return true
}

export function pushErrorMessage(reason: unknown, lang: 'ar' | 'en') {
  const key = reason instanceof Error ? reason.message : 'server'
  const messages = {
    ar: {
      unsupported: 'هذا المتصفح لا يدعم الإشعارات أو أن الاتصال غير آمن.',
      blocked: 'الإشعارات محظورة من إعدادات المتصفح. فعّلها لهذا الموقع من إعدادات المتصفح ثم حاول مجددًا.',
      dismissed: 'لم يتم منح الإذن. يمكنك المحاولة مرة أخرى في أي وقت.',
      server: 'تعذّر تفعيل الإشعارات الآن. حاول مرة أخرى.',
    },
    en: {
      unsupported: 'This browser does not support notifications, or the connection is not secure.',
      blocked: 'Notifications are blocked by your browser. Allow them for this site in browser settings, then try again.',
      dismissed: 'Permission was not granted. You can try again at any time.',
      server: 'Notifications could not be enabled right now. Please try again.',
    },
  }
  return messages[lang][key as keyof (typeof messages)['en']] ?? messages[lang].server
}

export function pushPromptStorageKey(userId: string) {
  return `swiftrbx.push-prompt-dismissed-at:${userId}`
}

export const PUSH_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000

export function isPushPromptDue(userId: string) {
  const dismissedAt = Number(window.localStorage.getItem(pushPromptStorageKey(userId)) ?? 0)
  return !dismissedAt || Date.now() - dismissedAt >= PUSH_PROMPT_INTERVAL_MS
}

export function recordPushPromptDismissal(userId: string) {
  window.localStorage.setItem(pushPromptStorageKey(userId), String(Date.now()))
}

export function clearPushPromptDismissal(userId: string) {
  window.localStorage.removeItem(pushPromptStorageKey(userId))
}

export async function storePushSubscription(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const admin = createAdminClient()
  const { error } = await admin.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: subscription.endpoint, ...getPushKeys(subscription), updated_at: new Date().toISOString() },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function removePushSubscription(userId: string, endpoint: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
  if (error) throw error
}

export async function listPushSubscriptions(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('push_subscriptions').select('endpoint').eq('user_id', userId)
  if (error) throw error
  return data ?? []
}

export async function isValidPushEndpoint(endpoint: unknown) {
  if (typeof endpoint !== 'string' || endpoint.length > 4096) return false
  try {
    return new URL(endpoint).protocol === 'https:'
  } catch {
    return false
  }
}

export function canUsePushApi() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

export function isPushPermissionGranted() {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
}

export function isPushPermissionDenied() {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied'
}
