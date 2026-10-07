import { sleep } from 'workflow'
import { start } from 'workflow/api'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReviewReminderPush } from '@/lib/push/server'

type MaintenanceCounts = {
  remindersSent: number
  completed: number
  catalogCompleted: number
}

async function runTicketReviewMaintenance(): Promise<MaintenanceCounts> {
  'use step'

  const admin = createAdminClient()
  const { data: reminders, error: reminderError } = await admin.rpc('claim_ticket_review_reminders')
  if (reminderError) throw new Error('Unable to claim review reminders')

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
  if (dueError) throw new Error('Unable to load expired orders')

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
  if (catalogError) throw new Error('Unable to load expired catalog tickets')

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

  return { remindersSent, completed, catalogCompleted }
}

export async function ticketReviewReminderHourWorkflow(): Promise<MaintenanceCounts> {
  'use workflow'

  const totals: MaintenanceCounts = { remindersSent: 0, completed: 0, catalogCompleted: 0 }
  for (let minute = 0; minute < 60; minute += 1) {
    await sleep('1m')
    const counts = await runTicketReviewMaintenance()
    totals.remindersSent += counts.remindersSent
    totals.completed += counts.completed
    totals.catalogCompleted += counts.catalogCompleted
  }
  return totals
}

export async function ticketReviewRemindersWorkflow() {
  'use workflow'

  for (let hour = 0; hour < 24; hour += 1) {
    let hourCompleted = false
    while (!hourCompleted) {
      try {
        const hourlyRun = await start(ticketReviewReminderHourWorkflow)
        await hourlyRun.returnValue
        hourCompleted = true
      } catch {
        await sleep('1m')
      }
    }
  }

  await start(ticketReviewRemindersWorkflow)
}
