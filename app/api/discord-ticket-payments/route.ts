import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBank, randomBank } from '@/lib/banks'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function isReceiptForBuyer(receiptUrl: unknown, buyerId: string) {
  if (typeof receiptUrl !== 'string') return false
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false

  try {
    const base = new URL(supabaseUrl)
    const receipt = new URL(receiptUrl)
    const expectedPath = `/storage/v1/object/public/receipts/${buyerId}/`
    return receipt.origin === base.origin && receipt.pathname.startsWith(expectedPath)
  } catch {
    return false
  }
}

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول بحساب المشتري المرتبط بالتذكرة.' }, { status: 401 })

  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    return NextResponse.json({ error: 'رابط الدفع غير صالح أو منتهي.' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: session, error } = await admin
    .from('discord_ticket_payments')
    .select('id, ticket_id, buyer_id, seller_name, offer_id, roblox_username, robux_amount, delivery_method, total_sar, bank_key, bank_name, bank_account, bank_iban, bank_holder, status, expires_at')
    .eq('token_hash', hashToken(token))
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (error || !session) return NextResponse.json({ error: 'رابط الدفع غير صالح أو منتهي.' }, { status: 404 })
  if (session.status !== 'issued') {
    return NextResponse.json({ error: 'تم استخدام رابط الدفع أو إلغاؤه بالفعل.' }, { status: 410 })
  }
  if (Date.parse(session.expires_at) <= Date.now()) {
    await admin.from('discord_ticket_payments').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', session.id).eq('status', 'issued')
    return NextResponse.json({ error: 'انتهت مهلة الدفع. تواصل مع الدعم لفتح طلب جديد.' }, { status: 410 })
  }

  let bank = session.bank_key ? getBank(session.bank_key) : undefined
  if (!bank) {
    const selected = randomBank()
    const { data: claimedBank } = await admin
      .from('discord_ticket_payments')
      .update({
        bank_key: selected.key,
        bank_name: selected.nameAr,
        bank_account: selected.account,
        bank_iban: selected.iban,
        bank_holder: selected.holder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .eq('status', 'issued')
      .is('bank_key', null)
      .select('bank_key, bank_name, bank_account, bank_iban, bank_holder')
      .maybeSingle()

    if (claimedBank) {
      bank = selected
    } else {
      const { data: refreshed } = await admin
        .from('discord_ticket_payments')
        .select('bank_key')
        .eq('id', session.id)
        .maybeSingle()
      bank = getBank(refreshed?.bank_key)
    }
  }
  if (!bank) return NextResponse.json({ error: 'تعذّر تجهيز بيانات التحويل. حاول مرة أخرى.' }, { status: 503 })

  return NextResponse.json({
    payment: {
      ticketId: session.ticket_id,
      sellerName: session.seller_name,
      offerId: session.offer_id,
      robloxUsername: session.roblox_username,
      amount: Number(session.robux_amount),
      delivery: session.delivery_method,
      totalSar: Number(session.total_sar),
      expiresAt: session.expires_at,
      bank: {
        key: bank.key,
        name: bank.name,
        nameAr: bank.nameAr,
        account: bank.account,
        iban: bank.iban,
        holder: bank.holder,
        reason: bank.reason,
      },
    },
  })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول بحساب المشتري المرتبط بالتذكرة.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 })
  const token = typeof body.token === 'string' ? body.token : ''
  const senderName = typeof body.senderName === 'string' ? body.senderName.trim() : ''
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return NextResponse.json({ error: 'رابط الدفع غير صالح.' }, { status: 400 })
  if (senderName.length < 2 || senderName.length > 120) return NextResponse.json({ error: 'أدخل اسم المحوّل بشكل صحيح.' }, { status: 400 })
  if (!isReceiptForBuyer(body.receiptUrl, user.id)) return NextResponse.json({ error: 'ارفع إيصال التحويل من حسابك قبل الإرسال.' }, { status: 400 })

  const admin = createAdminClient()
  const tokenHash = hashToken(token)
  const { data: session, error: sessionError } = await admin
    .from('discord_ticket_payments')
    .select('id, ticket_id, buyer_id, seller_id, offer_id, roblox_username, robux_amount, delivery_method, seller_name, unit_rate, total_sar, bank_key, expires_at, status, submission_started_at, order_id')
    .eq('token_hash', tokenHash)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (sessionError || !session) return NextResponse.json({ error: 'رابط الدفع غير صالح أو منتهي.' }, { status: 404 })
  if (session.status === 'submitted' && session.order_id) {
    return NextResponse.json({ orderId: session.order_id, status: 'confirming', alreadySubmitted: true })
  }
  if (session.status === 'expired' || session.status === 'cancelled' || Date.parse(session.expires_at) <= Date.now()) {
    await admin.from('discord_ticket_payments').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', session.id).eq('status', 'issued')
    return NextResponse.json({ error: 'انتهت مهلة الدفع أو أُلغي الطلب.' }, { status: 410 })
  }

  const { data: existingOrder } = await admin
    .from('orders')
    .select('id')
    .eq('discord_ticket_payment_id', session.id)
    .maybeSingle()
  if (existingOrder) {
    await admin.from('discord_ticket_payments').update({ status: 'submitted', order_id: existingOrder.id, updated_at: new Date().toISOString() }).eq('id', session.id)
    return NextResponse.json({ orderId: existingOrder.id, status: 'confirming', alreadySubmitted: true })
  }

  if (session.status === 'submitting') {
    const staleBefore = new Date(Date.now() - 3 * 60_000).toISOString()
    if (!session.submission_started_at || Date.parse(session.submission_started_at) > Date.parse(staleBefore)) {
      return NextResponse.json({ error: 'جارٍ معالجة الإيصال. حدّث الصفحة بعد لحظات.' }, { status: 409 })
    }
    await admin
      .from('discord_ticket_payments')
      .update({ status: 'issued', submission_started_at: null, updated_at: new Date().toISOString() })
      .eq('id', session.id)
      .eq('status', 'submitting')
      .lt('submission_started_at', staleBefore)
  }

  const now = new Date().toISOString()
  const { data: claim } = await admin
    .from('discord_ticket_payments')
    .update({ status: 'submitting', submission_started_at: now, updated_at: now })
    .eq('id', session.id)
    .eq('status', 'issued')
    .gt('expires_at', now)
    .select('id')
    .maybeSingle()
  if (!claim) return NextResponse.json({ error: 'تم استخدام رابط الدفع أو انتهت صلاحيته.' }, { status: 409 })

  const resetSession = async () => {
    await admin
      .from('discord_ticket_payments')
      .update({ status: 'issued', submission_started_at: null, updated_at: new Date().toISOString() })
      .eq('id', session.id)
      .eq('status', 'submitting')
  }

  const { data: offer } = await admin
    .from('offers')
    .select('id, seller_id, active, available, min_amount, max_amount, delivery')
    .eq('id', session.offer_id)
    .eq('seller_id', session.seller_id)
    .eq('active', true)
    .maybeSingle()
  if (!offer || Number(offer.available) < Number(session.robux_amount) ||
      Number(offer.min_amount) > Number(session.robux_amount) || Number(offer.max_amount) < Number(session.robux_amount) ||
      !Array.isArray(offer.delivery) || !offer.delivery.includes(session.delivery_method)) {
    await resetSession()
    return NextResponse.json({ error: 'لم يعد المخزون متاحًا لهذه الكمية. لا تحوّل المبلغ وتواصل مع الدعم.' }, { status: 409 })
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      buyer_id: user.id,
      seller_id: session.seller_id,
      offer_id: session.offer_id,
      robux_amount: session.robux_amount,
      roblox_username: session.roblox_username,
      delivery_method: session.delivery_method,
      price_sar: session.total_sar,
      payment_method: 'bank_transfer',
      bank_key: session.bank_key,
      receipt_url: body.receiptUrl,
      sender_name: senderName,
      status: 'confirming',
      discord_ticket_payment_id: session.id,
    })
    .select('id')
    .single()

  if (orderError || !order) {
    const { data: recoveredOrder } = await admin.from('orders').select('id').eq('discord_ticket_payment_id', session.id).maybeSingle()
    if (!recoveredOrder) {
      await resetSession()
      return NextResponse.json({ error: 'تعذّر تسجيل الإيصال. حاول مرة أخرى.' }, { status: 500 })
    }
    await admin.from('discord_ticket_payments').update({ status: 'submitted', order_id: recoveredOrder.id, receipt_url: body.receiptUrl, sender_name: senderName, updated_at: new Date().toISOString() }).eq('id', session.id)
    return NextResponse.json({ orderId: recoveredOrder.id, status: 'confirming', alreadySubmitted: true })
  }

  const { data: ticket } = await admin
    .from('tickets')
    .insert({
      type: 'order',
      subject: `طلب ${Number(session.robux_amount).toLocaleString('en-US')} روبوكس`,
      order_id: order.id,
      buyer_id: user.id,
      seller_id: session.seller_id,
      status: 'pending_payment',
    })
    .select('id')
    .maybeSingle()

  if (ticket) {
    await admin.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      body: `طلب Discord ${session.ticket_id}: ${Number(session.robux_amount).toLocaleString('en-US')} R$ إلى حساب روبلوكس "${session.roblox_username}". إيصال التحويل بانتظار مراجعة الإدارة.`,
    })
  }

  await admin.from('discord_ticket_payments').update({
    status: 'submitted',
    order_id: order.id,
    receipt_url: body.receiptUrl,
    sender_name: senderName,
    submission_started_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', session.id).eq('status', 'submitting')

  return NextResponse.json({ orderId: order.id, ticketId: ticket?.id ?? null, status: 'confirming', toPay: Number(session.total_sar) })
}
