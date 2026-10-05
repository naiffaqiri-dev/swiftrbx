import { NextResponse } from 'next/server'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVapidKeys } from '@/lib/push/server'
import { getPushKeys, isValidPushSubscription } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscription = await request.json().catch(() => null)
  if (!isValidPushSubscription(subscription)
    || subscription.keys.p256dh.length > 256
    || subscription.keys.auth.length > 256) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { error: subscriptionError } = await admin.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        ...getPushKeys(subscription),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
    if (subscriptionError) throw subscriptionError

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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { enabled?: unknown } | null
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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null
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
