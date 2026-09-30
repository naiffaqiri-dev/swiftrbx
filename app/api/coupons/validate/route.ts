import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول للتحقق من الكوبون' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
  const subtotal = Number(body?.subtotal)
  if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !Number.isFinite(subtotal) || subtotal <= 0 || subtotal > 1_000_000_000) {
    return NextResponse.json({ error: 'أدخل رمزاً صالحاً وقيمة طلب صحيحة' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('redeem_coupon', {
    p_code: code,
    p_user_id: user.id,
    p_subtotal: subtotal,
  })
  if (error) {
    const reason = error.message ?? ''
    const message = reason.includes('COUPON_LIMIT_REACHED')
      ? 'انتهت مرات استخدام هذا الكوبون'
      : reason.includes('COUPON_USER_LIMIT_REACHED')
        ? 'استنفدت مرات استخدامك لهذا الكوبون'
        : reason.includes('COUPON_NOT_ELIGIBLE')
          ? 'هذا الكوبون غير متاح لحسابك أو لهذه القيمة'
          : 'الكوبون غير صالح أو غير متاح'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const discount = Number(data)
  if (!Number.isFinite(discount) || discount <= 0 || discount > subtotal) {
    return NextResponse.json({ error: 'الكوبون غير صالح أو غير متاح' }, { status: 400 })
  }
  return NextResponse.json({ code, discount })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
