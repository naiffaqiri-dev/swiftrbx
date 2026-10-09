import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { USERNAME_RE } from '@/lib/password'

const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AMOUNT_RE = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/

const TRANSFER_ERRORS: Record<string, { status: number; message: string }> = {
  'اسم المستخدم غير صالح': { status: 400, message: 'اسم المستخدم غير صالح' },
  'المبلغ غير صالح': { status: 400, message: 'المبلغ غير صالح' },
  'المستخدم غير موجود أو غير نشط': { status: 404, message: 'المستخدم غير موجود أو غير نشط' },
  'الملف الشخصي غير موجود أو غير نشط': { status: 404, message: 'الملف الشخصي غير موجود أو غير نشط' },
  'لا يمكنك تحويل الرصيد إلى حسابك': { status: 400, message: 'لا يمكنك تحويل الرصيد إلى حسابك' },
  'رصيدك غير كافٍ لإتمام التحويل': { status: 400, message: 'رصيدك غير كافٍ لإتمام التحويل' },
  'رصيد المستلم تجاوز الحد المسموح': { status: 400, message: 'رصيد المستلم تجاوز الحد المسموح' },
  'تجاوزت عدد التحويلات المسموح. حاول بعد قليل': { status: 429, message: 'تجاوزت عدد التحويلات المسموح. حاول بعد قليل' },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  let parsedBody: unknown
  try {
    parsedBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }
  const body = parsedBody as { recipientUsername?: unknown; amount?: unknown; requestId?: unknown }

  const recipientUsername = typeof body.recipientUsername === 'string' ? body.recipientUsername.trim() : ''
  const amountInput = typeof body.amount === 'string' ? body.amount.trim() : ''
  const requestId = typeof body.requestId === 'string' ? body.requestId : ''
  const amount = Number(amountInput)

  if (!USERNAME_RE.test(recipientUsername)) {
    return NextResponse.json({ error: 'اسم المستخدم غير صالح' }, { status: 400 })
  }
  if (!AMOUNT_RE.test(amountInput) || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 })
  }
  if (!REQUEST_ID_RE.test(requestId)) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('transfer_balance', {
    p_sender_id: user.id,
    p_recipient_username: recipientUsername,
    p_amount: amount,
    p_request_id: requestId,
  })

  if (error) {
    const mappedError = TRANSFER_ERRORS[error.message]
    if (mappedError) {
      return NextResponse.json({ error: mappedError.message }, { status: mappedError.status })
    }
    return NextResponse.json({ error: 'تعذّر تنفيذ التحويل، حاول مرة أخرى' }, { status: 500 })
  }

  const transfer = Array.isArray(data) ? data[0] : null
  if (!transfer) {
    return NextResponse.json({ error: 'تعذّر تأكيد التحويل' }, { status: 500 })
  }

  return NextResponse.json(
    {
      ok: true,
      transfer: {
        id: transfer.transfer_id,
        senderBalance: Number(transfer.sender_balance),
        recipientBalance: Number(transfer.recipient_balance),
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
