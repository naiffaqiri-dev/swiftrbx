import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTicketPush } from '@/lib/push/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticketId } = await params
  const body = await request.json().catch(() => null) as { messageId?: unknown } | null
  if (typeof body?.messageId !== 'string') {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  }

  const admin = createAdminClient()
  const [{ data: ticket, error: ticketError }, { data: message, error: messageError }] = await Promise.all([
    admin.from('tickets').select('id, buyer_id, seller_id').eq('id', ticketId).maybeSingle(),
    admin.from('ticket_messages').select('id, sender_id').eq('id', body.messageId).eq('ticket_id', ticketId).maybeSingle(),
  ])

  if (ticketError || messageError) {
    return NextResponse.json({ error: 'Unable to verify message' }, { status: 500 })
  }
  if (!ticket || !message || message.sender_id !== user.id) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const recipientId = ticket.buyer_id === user.id
    ? ticket.seller_id
    : ticket.seller_id === user.id
      ? ticket.buyer_id
      : null
  if (recipientId) await sendTicketPush(recipientId, ticket.id)

  return NextResponse.json({ ok: true })
}
