import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashDiscordTicketToken, lookupDiscordTicketPayment } from '@/lib/discord-ticket-payments'

const UNUSABLE_LINK_MESSAGES = {
  not_found: { status: 404, error: 'الرابط غير صحيح، افتح الرابط من ديسكورد مجددًا' },
  already_submitted: { status: 409, error: 'تم إرسال إيصال لهذا الطلب مسبقًا' },
  expired: { status: 410, error: 'انتهت صلاحية الرابط، اطلب رابطًا جديدًا من ديسكورد' },
} as const

type SubmitBody = {
  token?: unknown
  receiptPath?: unknown
  senderName?: unknown
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as SubmitBody | null
  const token = typeof body?.token === 'string' ? body.token : ''
  const receiptPath = typeof body?.receiptPath === 'string' ? body.receiptPath : ''
  const senderName = typeof body?.senderName === 'string' ? body.senderName.trim() : ''

  if (!token || token.length > 512 || !senderName || senderName.length > 100) {
    return NextResponse.json({ error: 'بيانات الإرسال غير صالحة' }, { status: 400 })
  }
  if (!receiptPath.startsWith(`${user.id}/`) || receiptPath.includes('..')) {
    return NextResponse.json({ error: 'مسار الإيصال غير صالح' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('active').eq('id', user.id).maybeSingle()
  if (!profile?.active) return NextResponse.json({ error: 'الحساب غير نشط' }, { status: 403 })

  const outcome = await lookupDiscordTicketPayment(token, user.id)
  if (outcome.kind !== 'ok') {
    return NextResponse.json(UNUSABLE_LINK_MESSAGES[outcome.kind], { status: UNUSABLE_LINK_MESSAGES[outcome.kind].status })
  }
  const { payment } = outcome

  const orderId = crypto.randomUUID()
  const { error: orderError } = await admin.from('orders').insert({
    id: orderId,
    buyer_id: user.id,
    seller_id: payment.seller_id,
    offer_id: payment.offer_id,
    robux_amount: payment.robux_amount,
    roblox_username: payment.roblox_username,
    delivery_method: payment.delivery_method,
    price_sar: payment.total_sar,
    payment_method: 'bank_transfer',
    bank_key: payment.bank_key,
    receipt_url: receiptPath,
    sender_name: senderName,
    status: 'confirming',
    discord_ticket_payment_id: payment.id,
  })
  if (orderError) return NextResponse.json({ error: 'تعذّر إنشاء الطلب، حاول مرة أخرى' }, { status: 500 })

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await admin
    .from('discord_ticket_payments')
    .update({
      status: 'submitted',
      order_id: orderId,
      receipt_url: receiptPath,
      sender_name: senderName,
      updated_at: now,
    })
    .eq('token_hash', hashDiscordTicketToken(token))
    .eq('buyer_id', user.id)
    .eq('status', 'issued')
    .gt('expires_at', now)
    .select('id, status, order_id')
    .maybeSingle()

  if (updateError || !updated) {
    await admin.from('orders').delete().eq('id', orderId)
    if (updateError) return NextResponse.json({ error: 'تعذّر حفظ الطلب، حاول مرة أخرى' }, { status: 500 })
    return NextResponse.json(UNUSABLE_LINK_MESSAGES.already_submitted, { status: 409 })
  }

  return NextResponse.json({ orderId, status: updated.status }, { status: 200 })
}

export const runtime = 'nodejs'
