import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type QueueRow = {
  ticket_id: string
  subject: string | null
  transferred_at: string | null
  transfer_reason: string | null
  robux_amount: number | string
  roblox_username: string
  delivery_method: string | null
  price_sar: number | string
}

async function getActiveSeller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, admin: null, error: NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle()
  if (error || profile?.role !== 'seller' || profile.active !== true) {
    return { user: null, admin: null, error: NextResponse.json({ error: 'هذه الميزة متاحة للبائعين النشطين فقط' }, { status: 403 }) }
  }

  return { user, admin, error: null }
}

export async function GET() {
  const { user, admin, error: authError } = await getActiveSeller()
  if (authError || !user || !admin) return authError

  const supabase = await createClient()
  const { data: queue, error } = await supabase.rpc('list_transferred_ticket_queue')
  if (error) {
    return NextResponse.json({ error: 'تعذّر تحميل قائمة التذاكر المحوّلة' }, { status: 500 })
  }
  const queueRows = (queue ?? []) as QueueRow[]
  if (!queueRows.length) return NextResponse.json({ tickets: [] })

  const ticketIds = queueRows.map((ticket) => ticket.ticket_id)
  const { data: ticketDetails } = await admin
    .from('tickets')
    .select('id, order_id, transfer_previous_seller_id')
    .in('id', ticketIds)
  const orderIds = [...new Set((ticketDetails ?? []).map((ticket) => ticket.order_id).filter((id): id is string => Boolean(id)))]
  const { data: orders } = orderIds.length
    ? await admin.from('orders').select('id, buyer_id').in('id', orderIds)
    : { data: [] }

  const profileIds = [...new Set([
    ...(ticketDetails ?? []).map((ticket) => ticket.transfer_previous_seller_id),
    ...(orders ?? []).map((order) => order.buyer_id),
  ].filter((id): id is string => Boolean(id)))]
  const { data: profiles } = profileIds.length
    ? await admin.from('profiles').select('id, username').in('id', profileIds)
    : { data: [] }

  const usernameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]))
  const ticketById = new Map((ticketDetails ?? []).map((ticket) => [ticket.id, ticket]))
  const buyerByOrderId = new Map((orders ?? []).map((order) => [order.id, usernameById.get(order.buyer_id) ?? '']))

  const tickets = queueRows.map((ticket) => {
    const details = ticketById.get(ticket.ticket_id)
    return {
      ticketId: ticket.ticket_id,
      subject: ticket.subject,
      transferredAt: ticket.transferred_at,
      transferReason: ticket.transfer_reason,
      robuxAmount: Number(ticket.robux_amount),
      robloxUsername: ticket.roblox_username,
      deliveryMethod: ticket.delivery_method,
      priceSar: Number(ticket.price_sar),
      buyerUsername: details?.order_id ? buyerByOrderId.get(details.order_id) ?? '' : '',
      previousSellerUsername: details?.transfer_previous_seller_id
        ? usernameById.get(details.transfer_previous_seller_id) ?? ''
        : '',
    }
  })

  return NextResponse.json({ tickets })
}

export async function POST(request: Request) {
  const { user, admin, error: authError } = await getActiveSeller()
  if (authError || !user || !admin) return authError

  const body = await request.json().catch(() => null) as { ticketId?: unknown; action?: unknown; reason?: unknown } | null
  if (!body || typeof body.ticketId !== 'string' || !UUID_PATTERN.test(body.ticketId)) {
    return NextResponse.json({ error: 'بيانات التذكرة غير صالحة' }, { status: 400 })
  }
  if (body.action !== 'transfer' && body.action !== 'claim') {
    return NextResponse.json({ error: 'الإجراء غير صالح' }, { status: 400 })
  }
  if (body.action === 'transfer' && body.reason !== undefined && typeof body.reason !== 'string') {
    return NextResponse.json({ error: 'سبب التحويل غير صالح' }, { status: 400 })
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null
  const { data: changed, error } = await admin.rpc('manage_ticket_transfer', {
    p_ticket_id: body.ticketId,
    p_actor_id: user.id,
    p_action: body.action,
    p_reason: reason,
  })
  if (error) {
    return NextResponse.json({ error: 'تعذّر تحديث التذكرة، حاول مرة أخرى' }, { status: 500 })
  }
  if (!changed) {
    return NextResponse.json({ error: 'تغيّرت حالة التذكرة أو استلمها بائع آخر. حدّث القائمة وحاول مجدداً.' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
