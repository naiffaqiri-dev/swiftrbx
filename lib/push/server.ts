import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

type StoredVapidKeys = { public_key: string; private_key: string }
type PushPayload = { title: string; body: string; url: string }

export async function getVapidKeys(): Promise<StoredVapidKeys> {
  const admin = createAdminClient()
  const { data: existing, error: readError } = await admin
    .from('push_vapid_keys')
    .select('public_key, private_key')
    .eq('id', 1)
    .maybeSingle()

  if (readError) throw readError
  if (existing) return existing

  const generated = webpush.generateVAPIDKeys()
  const { error: insertError } = await admin.from('push_vapid_keys').insert({
    id: 1,
    public_key: generated.publicKey,
    private_key: generated.privateKey,
  })

  if (insertError) {
    const { data: racedKey, error: retryError } = await admin
      .from('push_vapid_keys')
      .select('public_key, private_key')
      .eq('id', 1)
      .single()
    if (retryError || !racedKey) throw insertError
    return racedKey
  }

  return { public_key: generated.publicKey, private_key: generated.privateKey }
}

export async function sendTicketPush(userId: string, ticketId: string) {
  try {
    const admin = createAdminClient()
    const [{ data: preference }, { data: subscriptions }, { data: ticket }] = await Promise.all([
      admin.from('push_notification_preferences').select('enabled').eq('user_id', userId).maybeSingle(),
      admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId),
      admin.from('tickets').select('subject').eq('id', ticketId).maybeSingle(),
    ])

    if (!preference?.enabled || !subscriptions?.length) return
    const keys = await getVapidKeys()
    webpush.setVapidDetails('mailto:notifications@swiftrbx.com', keys.public_key, keys.private_key)
    const payload: PushPayload = {
      title: 'رسالة جديدة من التذكرة',
      body: ticket?.subject ? `لديك رسالة جديدة في: ${ticket.subject}` : 'لديك رسالة جديدة في التذكرة',
      url: `/tickets/${encodeURIComponent(ticketId)}`,
    }

    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        )
      } catch (error) {
        const statusCode = typeof error === 'object' && error && 'statusCode' in error
          ? Number(error.statusCode)
          : 0
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', subscription.id)
        }
      }
    }))
  } catch {
    // Push delivery must never make a successfully stored ticket message fail.
  }
}

export async function sendReviewReminderPush(
  userId: string,
  orderId: string,
  ticketId: string | null,
  remainingMinutes: 20 | 10,
) {
  try {
    const admin = createAdminClient()
    const [{ data: preference }, { data: subscriptions }] = await Promise.all([
      admin.from('push_notification_preferences').select('enabled').eq('user_id', userId).maybeSingle(),
      admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId),
    ])
    if (!preference?.enabled || !subscriptions?.length) return

    const keys = await getVapidKeys()
    configureWebPush(keys)
    const payload: PushPayload = {
      title: 'يرجى تقييم البائع',
      body: `يرجى التقييم؛ العدّ التنازلي عند الدقيقة ${remainingMinutes} من 30 للطلب #${orderId.slice(0, 8)}.`,
      url: ticketId ? `/tickets/${encodeURIComponent(ticketId)}` : '/dashboard',
    }
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await sendPushNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
        )
      } catch (error) {
        const statusCode = typeof error === 'object' && error && 'statusCode' in error
          ? Number(error.statusCode)
          : 0
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', subscription.id)
        }
      }
    }))
  } catch {
    // Push delivery is best-effort and must not block the scheduled order completion.
  }
}

const PUSH_SERVICE_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
])
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/

export function isValidPushSubscription(value: unknown): value is {
  endpoint: string
  keys: { p256dh: string; auth: string }
} {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  if (typeof candidate.endpoint !== 'string' || candidate.endpoint.length > 4096) return false

  let endpoint: URL
  try {
    endpoint = new URL(candidate.endpoint)
  } catch {
    return false
  }

  const p256dh = candidate.keys?.p256dh
  const auth = candidate.keys?.auth
  return endpoint.protocol === 'https:'
    && endpoint.port === ''
    && PUSH_SERVICE_HOSTS.has(endpoint.hostname.toLowerCase())
    && typeof p256dh === 'string'
    && p256dh.length >= 32
    && p256dh.length <= 256
    && BASE64_URL_PATTERN.test(p256dh)
    && typeof auth === 'string'
    && auth.length >= 16
    && auth.length <= 256
    && BASE64_URL_PATTERN.test(auth)
}

export function getPushKeys(value: { keys: { p256dh: string; auth: string } }) {
  return { p256dh: value.keys.p256dh, auth: value.keys.auth }
}

export function configureWebPush(keys: StoredVapidKeys) {
  webpush.setVapidDetails('mailto:notifications@swiftrbx.com', keys.public_key, keys.private_key)
}

export function generateVapidKeys() {
  return webpush.generateVAPIDKeys()
}

export function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
) {
  return webpush.sendNotification(subscription, JSON.stringify(payload))
}

export type { StoredVapidKeys, PushPayload }
