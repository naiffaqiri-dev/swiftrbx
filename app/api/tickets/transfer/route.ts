import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const { data: ticketRows, error: ticketError } = await admin
    .from('tickets')
    .select('id, subject, order_id, transferred_at, transfer_reason, transfer_previous_seller_id')
    .eq('type', 'order')
    .eq('status', 'transferred')
    .is('seller_id', null)
    .not('order_id', 'is', null)
  if (ticketError) {
    return NextResponse.json({ error: 'تعذّر تحميل قائمة التذاكر المحوّلة' }, { status: 500 })
  }
  if (!ticketRows?.length) return NextResponse.json({ tickets: [] })

  const orderIds = [...new Set(ticketRows.map((ticket) => ticket.order_id).filter((id): id is string => Boolean(id)))]
  const { data: orders, error: orderError } = await admin
    .from('orders')
    .select('id, buyer_id, robux_amount, roblox_username, delivery_method, price_sar')
    .in('id', orderIds)
    .is('seller_id', null)
    .eq('status', 'processing')
  if (orderError) {
    return NextResponse.json({ error: 'تعذّر تحميل بيانات الطلبات المحوّلة' }, { status: 500 })
  }

  const ordersById = new Map((orders ?? []).map((order) => [order.id, order]))
  const visibleTickets = ticketRows.filter((ticket) => ticket.order_id && ordersById.has(ticket.order_id))
  if (!visibleTickets.length) return NextResponse.json({ tickets: [] })

  const profileIds = [...new Set([
    ...visibleTickets.map((ticket) => ticket.transfer_previous_seller_id),
    ...visibleTickets.map((ticket) => {
      const order = ticket.order_id ? ordersById.get(ticket.order_id) : null
      return order?.buyer_id ?? null
    }),
  ].filter((id): id is string => Boolean(id)))]
  const { data: profiles, error: profileError } = profileIds.length
    ? await admin.from('profiles').select('id, username').in('id', profileIds)
    : { data: [], error: null }
  if (profileError) {
    return NextResponse.json({ error: 'تعذّر تحميل أسماء أطراف الطلب' }, { status: 500 })
  }

  const usernameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]))
  const tickets = visibleTickets.flatMap((ticket) => {
    const order = ticket.order_id ? ordersById.get(ticket.order_id) : null
    if (!order) return []
    return [{
      ticketId: ticket.id,
      subject: ticket.subject,
      transferredAt: ticket.transferred_at,
      transferReason: ticket.transfer_reason,
      robuxAmount: Number(order.robux_amount),
      robloxUsername: order.roblox_username,
      deliveryMethod: order.delivery_method,
      priceSar: Number(order.price_sar),
      buyerUsername: usernameById.get(order.buyer_id) ?? '',
      previousSellerUsername: ticket.transfer_previous_seller_id
        ? usernameById.get(ticket.transfer_previous_seller_id) ?? ''
        : '',
    }]
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
