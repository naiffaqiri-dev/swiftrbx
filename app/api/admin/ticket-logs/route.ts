import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 50
const COMPLETED_STATUSES = ['completed', 'closed', 'resolved']

export async function GET(request: Request) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError) return NextResponse.json({ error: 'Unable to verify access' }, { status: 500 })
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const params = new URL(request.url).searchParams
  const pageValue = Number(params.get('page') ?? 1)
  const page = Number.isSafeInteger(pageValue) ? Math.min(Math.max(pageValue, 1), 10_000) : 1
  const status = params.get('status')
  let query = admin
    .from('tickets')
    .select('id, type, subject, status, buyer_id, seller_id, order_id, created_at, updated_at, close_reason, catalog_quantity, closed_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (status === 'completed') query = query.in('status', COMPLETED_STATUSES)
  if (status === 'open') query = query.not('status', 'in', `(${COMPLETED_STATUSES.join(',')})`)

  const { data: tickets, count, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load ticket logs' }, { status: 500 })

  const rows = tickets ?? []
  const orderIds = [...new Set(rows.flatMap((ticket) => ticket.order_id ? [ticket.order_id] : []))]
  const profileIds = [...new Set(rows.flatMap((ticket) => [ticket.buyer_id, ticket.seller_id].filter((id): id is string => Boolean(id))))]
  const [{ data: orders, error: ordersError }, { data: profiles, error: profilesError }] = await Promise.all([
    orderIds.length
      ? admin.from('orders').select('id, robux_amount, delivery_method').in('id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? admin.from('profiles').select('id, username, display_name').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (ordersError || profilesError) return NextResponse.json({ error: 'Unable to load ticket details' }, { status: 500 })

  const orderById = new Map((orders ?? []).map((order) => [order.id, order]))
  const profileById = new Map((profiles ?? []).map((item) => [item.id, item]))
  const logs = rows.map((ticket) => {
    const order = ticket.order_id ? orderById.get(ticket.order_id) : null
    const buyer = profileById.get(ticket.buyer_id)
    const seller = ticket.seller_id ? profileById.get(ticket.seller_id) : null
    return {
      id: ticket.id,
      type: ticket.type,
      subject: ticket.subject,
      status: ticket.status,
      buyer: buyer?.display_name || buyer?.username || '',
      seller: seller?.display_name || seller?.username || '',
      order_id: ticket.order_id,
      quantity: order?.robux_amount ?? ticket.catalog_quantity,
      delivery_method: order?.delivery_method ?? null,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      closed_at: ticket.closed_at,
      close_reason: ticket.close_reason,
    }
  })

  return NextResponse.json({ logs, count: count ?? 0, page, pageSize: PAGE_SIZE }, { headers: { 'Cache-Control': 'private, no-store' } })
}
