import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lookupDiscordTicketPayment } from '@/lib/discord-ticket-payments'

const OUTCOME_RESPONSES = {
  not_found: { status: 404, error: 'الرابط غير صحيح، افتح الرابط من ديسكورد مجددًا' },
  already_submitted: { status: 409, error: 'تم إرسال إيصال لهذا الطلب مسبقًا' },
  expired: { status: 410, error: 'انتهت صلاحية الرابط، اطلب رابطًا جديدًا من ديسكورد' },
} as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token || token.length > 512) {
    return NextResponse.json(OUTCOME_RESPONSES.not_found, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('active').eq('id', user.id).maybeSingle()
  if (!profile?.active) return NextResponse.json({ error: 'الحساب غير نشط' }, { status: 403 })

  const outcome = await lookupDiscordTicketPayment(token, user.id)
  if (outcome.kind !== 'ok') return NextResponse.json(OUTCOME_RESPONSES[outcome.kind], { status: OUTCOME_RESPONSES[outcome.kind].status })

  const { payment } = outcome
  return NextResponse.json({
    payment: {
      robuxAmount: Number(payment.robux_amount),
      robloxUsername: payment.roblox_username,
      deliveryMethod: payment.delivery_method,
      sellerName: payment.seller_name,
      totalSar: Number(payment.total_sar),
      expiresAt: payment.expires_at,
      bank: {
        name: payment.bank_name,
        account: payment.bank_account,
        iban: payment.bank_iban,
        holder: payment.bank_holder,
      },
    },
  })
}

export const runtime = 'nodejs'
