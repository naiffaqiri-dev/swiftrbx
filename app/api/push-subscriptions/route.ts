import { NextResponse } from 'next/server'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPushKeys, getVapidKeys, isValidPushSubscription } from '@/lib/push/server'

export const dynamic = 'force-dynamic'

const MAX_REQUEST_BYTES = 8 * 1024

type JsonBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 }

async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  const reader = request.body?.getReader()
  if (!reader) return { ok: false, status: 400 }

  const chunks: Uint8Array[] = []
  let byteLength = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > MAX_REQUEST_BYTES) {
        void reader.cancel().catch(() => undefined)
        return { ok: false, status: 413 }
      }
      chunks.push(value)
    }

    const body = new Uint8Array(byteLength)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(body)) }
  } catch {
    return { ok: false, status: 400 }
  }
}

function isSameOriginJsonRequest(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') return false

  const origin = request.headers.get('origin')
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site'

  try {
    const originUrl = new URL(origin)
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim()
    const expectedHost = forwardedHost || request.headers.get('host') || new URL(request.url).host
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
    return (originUrl.protocol === 'https:' || originUrl.protocol === 'http:')
      && originUrl.host.toLowerCase() === expectedHost.toLowerCase()
      && (!forwardedProtocol || originUrl.protocol === `${forwardedProtocol}:`)
  } catch {
    return false
  }
}

async function getCurrentUser() {
  const supabase = await createSessionClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [keys, preferenceResult] = await Promise.all([
      getVapidKeys(),
      createAdminClient()
        .from('push_notification_preferences')
        .select('enabled')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])
    if (preferenceResult.error) throw preferenceResult.error
    return NextResponse.json(
      { publicKey: keys.public_key, enabled: preferenceResult.data?.enabled ?? false },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'Push notifications are unavailable' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  if (!isSameOriginJsonRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await readJsonBody(request)
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.status === 413 ? 'Request body too large' : 'Invalid JSON' },
      { status: parsedBody.status },
    )
  }
  const subscription = parsedBody.value
  if (!isValidPushSubscription(subscription)) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data: existing, error: lookupError } = await admin
      .from('push_subscriptions')
      .select('id, user_id')
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (existing && existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Subscription belongs to another account' }, { status: 409 })
    }

    const subscriptionRow = {
      user_id: user.id,
      endpoint: subscription.endpoint,
      ...getPushKeys(subscription),
      updated_at: new Date().toISOString(),
    }
    if (existing) {
      const { data: updated, error: updateError } = await admin
        .from('push_subscriptions')
        .update(subscriptionRow)
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle()
      if (updateError) throw updateError
      if (!updated) return NextResponse.json({ error: 'Subscription changed; try again' }, { status: 409 })
    } else {
      const { error: insertError } = await admin.from('push_subscriptions').insert(subscriptionRow)
      if (insertError) throw insertError
    }

    const { error: preferenceError } = await admin.from('push_notification_preferences').upsert(
      { user_id: user.id, enabled: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (preferenceError) throw preferenceError
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to save subscription' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginJsonRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await readJsonBody(request)
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.status === 413 ? 'Request body too large' : 'Invalid JSON' },
      { status: parsedBody.status },
    )
  }
  const body = parsedBody.value as { enabled?: unknown } | null
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid preference' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    if (body.enabled) {
      const { count, error } = await admin
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (error) throw error
      if (!count) return NextResponse.json({ error: 'No browser subscription' }, { status: 409 })
    }

    const { error } = await admin.from('push_notification_preferences').upsert(
      { user_id: user.id, enabled: body.enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (error) throw error
    return NextResponse.json({ enabled: body.enabled })
  } catch {
    return NextResponse.json({ error: 'Unable to update preference' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginJsonRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await readJsonBody(request)
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.status === 413 ? 'Request body too large' : 'Invalid JSON' },
      { status: parsedBody.status },
    )
  }
  const body = parsedBody.value as { endpoint?: unknown } | null
  if (typeof body?.endpoint !== 'string' || body.endpoint.length > 4096) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { error: deleteError } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', body.endpoint)
    if (deleteError) throw deleteError

    const { error: preferenceError } = await admin.from('push_notification_preferences').upsert(
      { user_id: user.id, enabled: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (preferenceError) throw preferenceError
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to remove subscription' }, { status: 500 })
  }
}
