import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const COUPON_COLUMNS = 'id, code, kind, percent, active, discount_type, fixed_amount, min_order_amount, max_discount, starts_at, expires_at, usage_limit, per_user_limit, audience, new_account_days, created_at'

async function requireAdmin() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, active').eq('id', user.id).maybeSingle()
  if (!profile?.active || !['owner', 'admin'].includes(profile.role)) {
    return { response: NextResponse.json({ error: 'غير مصرّح' }, { status: 403 }) }
  }
  return { admin }
}

function positiveNullableInt(value: unknown) {
  if (value === null || value === '' || value === undefined) return null
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : undefined
}

function nonNegativeMoney(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 1_000_000_000 ? number : undefined
}

function parseDate(value: unknown) {
  if (value === null || value === '' || value === undefined) return null
  if (typeof value !== 'string') return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

export async function GET() {
  const context = await requireAdmin()
  if ('response' in context) return context.response

  const { data, error } = await context.admin.from('coupons')
    .select(COUPON_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'تعذّر تحميل الكوبونات' }, { status: 500 })

  const ids = (data ?? []).map((coupon) => coupon.id)
  const { data: redemptions } = ids.length
    ? await context.admin.from('coupon_redemptions').select('coupon_id').in('coupon_id', ids)
    : { data: [] }
  const redemptionCounts = new Map<string, number>()
  for (const redemption of redemptions ?? []) {
    redemptionCounts.set(redemption.coupon_id, (redemptionCounts.get(redemption.coupon_id) ?? 0) + 1)
  }
  return NextResponse.json({ coupons: (data ?? []).map((coupon) => ({ ...coupon, redeemed_count: redemptionCounts.get(coupon.id) ?? 0 })) })
}

export async function POST(request: Request) {
  const context = await requireAdmin()
  if ('response' in context) return context.response
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'البيانات غير صالحة' }, { status: 400 })

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const kind = body.kind === 'referral' ? 'referral' : body.kind === 'discount' ? 'discount' : null
  const discountType = body.discount_type === 'fixed' ? 'fixed' : body.discount_type === 'percent' ? 'percent' : null
  const audience = ['all', 'new_accounts', 'first_order', 'returning'].includes(body.audience) ? body.audience : null
  const value = nonNegativeMoney(body.value)
  const minOrder = nonNegativeMoney(body.min_order_amount)
  const maxDiscount = body.max_discount === null || body.max_discount === '' ? null : nonNegativeMoney(body.max_discount)
  const usageLimit = positiveNullableInt(body.usage_limit)
  const perUserLimit = positiveNullableInt(body.per_user_limit)
  const newAccountDays = positiveNullableInt(body.new_account_days)
  const startsAt = parseDate(body.starts_at)
  const expiresAt = parseDate(body.expires_at)

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return NextResponse.json({ error: 'استخدم 3 إلى 32 حرفاً أو رقماً أو - أو _' }, { status: 400 })
  if (!kind || !discountType || !audience || value === undefined || minOrder === undefined ||
      (body.max_discount !== null && body.max_discount !== '' && body.max_discount !== undefined && maxDiscount === undefined) ||
      usageLimit === undefined || perUserLimit === undefined || newAccountDays === undefined ||
      startsAt === undefined || expiresAt === undefined || (discountType === 'percent' && (value <= 0 || value > 100)) ||
      (discountType === 'fixed' && value <= 0) || (audience === 'new_accounts' && !newAccountDays) ||
      (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt))) {
    return NextResponse.json({ error: 'تحقق من نوع الخصم وقيمه وشروطه والتواريخ' }, { status: 400 })
  }

  const { data: coupon, error } = await context.admin.from('coupons').insert({
    code,
    kind,
    percent: discountType === 'percent' ? value : 0,
    discount_type: discountType,
    fixed_amount: discountType === 'fixed' ? value : 0,
    min_order_amount: minOrder,
    max_discount: maxDiscount,
    starts_at: startsAt,
    expires_at: expiresAt,
    usage_limit: usageLimit,
    per_user_limit: perUserLimit,
    audience,
    new_account_days: newAccountDays ?? 30,
    active: true,
  }).select(COUPON_COLUMNS).single()

  if (error) {
    const duplicate = error.code === '23505' || error.message.toLowerCase().includes('duplicate')
    return NextResponse.json({ error: duplicate ? 'هذا الرمز موجود مسبقاً' : 'تعذّر إنشاء الكوبون' }, { status: duplicate ? 409 : 500 })
  }
  return NextResponse.json({ coupon: { ...coupon, redeemed_count: 0 } }, { status: 201 })
}

export async function PATCH(request: Request) {
  const context = await requireAdmin()
  if ('response' in context) return context.response
  const body = await request.json().catch(() => null)
  if (!body || typeof body.id !== 'string' || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'بيانات التحديث غير صالحة' }, { status: 400 })
  }
  const { data, error } = await context.admin.from('coupons')
    .update({ active: body.active })
    .eq('id', body.id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'تعذّر تحديث حالة الكوبون' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'الكوبون غير موجود' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const context = await requireAdmin()
  if ('response' in context) return context.response
  const body = await request.json().catch(() => null)
  if (!body || typeof body.id !== 'string') return NextResponse.json({ error: 'معرّف الكوبون غير صالح' }, { status: 400 })

  const { count, error: countError } = await context.admin.from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', body.id)
  if (countError) return NextResponse.json({ error: 'تعذّر التحقق من استخدامات الكوبون' }, { status: 500 })
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'لا يمكن حذف كوبون استُخدم؛ يمكنك تعطيله بدلاً من ذلك' }, { status: 409 })

  const { data, error } = await context.admin.from('coupons').delete().eq('id', body.id).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'تعذّر حذف الكوبون' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'الكوبون غير موجود' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10
export const fetchCache = 'force-no-store'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: 'GET, POST, PATCH, DELETE, OPTIONS' } })
}
