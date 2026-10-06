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

  return NextResponse.json({ ok: true, remindersSent, completed })
}
