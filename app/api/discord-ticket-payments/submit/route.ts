import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,256}$/

type SubmitBody = {
  token?: unknown
  orderId?: unknown
  receiptPath?: unknown
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as SubmitBody | null
  const token = typeof body?.token === 'string' ? body.token : ''
  const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
  const receiptPath = typeof body?.receiptPath === 'string' ? body.receiptPath : ''

  if (!TOKEN_PATTERN.test(token) || !UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }
  if (!receiptPath.startsWith(`${user.id}/`) || receiptPath.includes('..')) {
    return NextResponse.json({ error: 'مسار الإيصال غير صالح' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('active').eq('id', user.id).maybeSingle()
  if (!profile?.active) return NextResponse.json({ error: 'الحساب غير نشط' }, { status: 403 })

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const now = new Date().toISOString()

  const { data: payment, error } = await admin
    .from('discord_ticket_payments')
    .update({
      status: 'submitted',
      order_id: orderId,
      receipt_url: receiptPath,
      updated_at: now,
    })
    .eq('token_hash', tokenHash)
    .eq('buyer_id', user.id)
    .eq('status', 'issued')
    .gt('expires_at', now)
    .select('id, status, order_id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'تعذّر حفظ الطلب، حاول مرة أخرى' }, { status: 500 })
  if (!payment) {
    return NextResponse.json({ error: 'الرابط غير صالح أو منتهي أو تم استخدامه' }, { status: 409 })
  }

  return NextResponse.json({ paymentId: payment.id, status: payment.status }, { status: 200 })
}

export const runtime = 'nodejs'
