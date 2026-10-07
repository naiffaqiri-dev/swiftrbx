import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTicketPush } from '@/lib/push/server'

export const dynamic = 'force-dynamic'

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  if (!isSameOriginJsonRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticketId } = await params
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 4096) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
  }
  const body = await request.json().catch(() => null) as { messageId?: unknown } | null
  if (typeof body?.messageId !== 'string' || body.messageId.length > 128) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  }

  const admin = createAdminClient()
  const [{ data: ticket, error: ticketError }, { data: message, error: messageError }] = await Promise.all([
    admin.from('tickets').select('id, buyer_id, seller_id').eq('id', ticketId).maybeSingle(),
    admin.from('ticket_messages').select('id, sender_id, created_at').eq('id', body.messageId).eq('ticket_id', ticketId).maybeSingle(),
  ])

  if (ticketError || messageError) {
    return NextResponse.json({ error: 'Unable to verify message' }, { status: 500 })
  }
  const messageCreatedAt = message ? new Date(message.created_at).getTime() : Number.NaN
  const messageAge = Date.now() - messageCreatedAt
  if (!ticket || !message || message.sender_id !== user.id || !Number.isFinite(messageCreatedAt)
    || messageAge < -60_000 || messageAge > 2 * 60_000) {
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
