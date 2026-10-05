export function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

async function savePushSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!response.ok) throw new Error('server')
}

export async function enableBrowserPush() {
  if (!canUsePushApi()) throw new Error('unsupported')

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'blocked' : 'dismissed')

  const registration = await navigator.serviceWorker.register('/sw.js')
  const keyResponse = await fetch('/api/push-subscriptions', { cache: 'no-store' })
  const keyData = await keyResponse.json().catch(() => ({})) as { publicKey?: unknown }
  if (!keyResponse.ok || typeof keyData.publicKey !== 'string') throw new Error('server')

  const subscription = (await registration.pushManager.getSubscription()) ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(keyData.publicKey),
  })
  await savePushSubscription(subscription)
  return subscription
}

export async function disableBrowserPush() {
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/sw.js') : undefined
  const subscription = await registration?.pushManager.getSubscription()

  if (subscription) {
    const response = await fetch('/api/push-subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
    if (!response.ok) throw new Error('server')
    await subscription.unsubscribe()
    return
  }

  const response = await fetch('/api/push-subscriptions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  })
  if (!response.ok) throw new Error('server')
}

export function canUsePushApi() {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
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

function pushPromptStorageKey(userId: string) {
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
