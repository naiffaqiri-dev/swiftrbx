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

export function isValidPushSubscription(value: unknown): value is {
  endpoint: string
  keys: { p256dh: string; auth: string }
} {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  return typeof candidate.endpoint === 'string'
    && candidate.endpoint.startsWith('https://')
    && candidate.endpoint.length <= 4096
    && typeof candidate.keys?.p256dh === 'string'
    && candidate.keys.p256dh.length <= 256
    && typeof candidate.keys?.auth === 'string'
    && candidate.keys.auth.length <= 256
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
