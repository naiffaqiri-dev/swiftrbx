import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReviewReminderPush } from '@/lib/push/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: reminders, error: reminderError } = await admin.rpc('claim_ticket_review_reminders')
  if (reminderError) return NextResponse.json({ error: 'Unable to claim review reminders' }, { status: 500 })

  let remindersSent = 0
  for (const reminder of reminders ?? []) {
    let ticketId: string | null = null
    if (reminder.ticket_id) {
      ticketId = reminder.ticket_id
    } else {
      const { data: ticket } = await admin.from('tickets').select('id').eq('order_id', reminder.order_id).maybeSingle()
      ticketId = ticket?.id ?? null
    }
    const remainingMinutes = reminder.kind === '20m' ? 20 : 10
    await sendReviewReminderPush(reminder.buyer_id, reminder.order_id, ticketId, remainingMinutes)
    remindersSent += 1
  }

  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: dueOrders, error: dueError } = await admin
    .from('orders')
    .select('id')
    .eq('status', 'delivered')
    .lte('delivered_at', cutoff)
    .order('delivered_at', { ascending: true })
    .limit(100)
  if (dueError) return NextResponse.json({ error: 'Unable to load expired orders', remindersSent }, { status: 500 })

  let completed = 0
  for (const order of dueOrders ?? []) {
    const { data, error } = await admin.rpc('auto_complete_delivered_order', { p_order_id: order.id })
    if (error) continue
    if (data?.length) completed += 1
  }

  const { data: dueCatalogTickets, error: catalogError } = await admin
    .from('tickets')
    .select('id')
    .eq('status', 'delivered')
    .not('catalog_item_id', 'is', null)
    .is('order_id', null)
    .not('delivered_at', 'is', null)
    .lte('delivered_at', cutoff)
    .order('delivered_at', { ascending: true })
    .limit(100)
  if (catalogError) {
    return NextResponse.json({ error: 'Unable to load expired catalog tickets', remindersSent, completed }, { status: 500 })
  }

  let catalogCompleted = 0
  for (const ticket of dueCatalogTickets ?? []) {
    const now = new Date().toISOString()
    const { data, error } = await admin
      .from('tickets')
      .update({
        status: 'completed',
        closed_at: now,
        close_reason: 'auto_completed_after_30_minutes_without_buyer_confirmation',
        updated_at: now,
      })
      .eq('id', ticket.id)
      .eq('status', 'delivered')
      .select('id')
      .maybeSingle()
    if (!error && data) catalogCompleted += 1
  }

  return NextResponse.json({ ok: true, remindersSent, completed, catalogCompleted })
}
