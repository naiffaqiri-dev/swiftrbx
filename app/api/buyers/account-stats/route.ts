import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 1000
const ALLOWED_PERIODS = new Set(['all', '1', '3', '6', '12'])

function getRangeStart(months: number) {
  const start = new Date()
  const day = start.getUTCDate()
  start.setUTCDate(1)
  start.setUTCMonth(start.getUTCMonth() - months)
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
  start.setUTCDate(Math.min(day, lastDay))
  return start.toISOString()
}

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') ?? '1'
  if (!ALLOWED_PERIODS.has(period)) {
    return NextResponse.json({ error: 'الفترة المحددة غير صالحة' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 })

  const admin = createAdminClient()
  const orders: { price_sar: number; robux_amount: number }[] = []
  const startAt = period === 'all' ? null : getRangeStart(Number(period))

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = admin
      .from('orders')
      .select('price_sar, robux_amount')
      .eq('buyer_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (startAt) query = query.gte('completed_at', startAt)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: 'تعذّر تحميل إحصائيات الحساب' }, { status: 500 })
    }
    orders.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  return NextResponse.json({
    purchaseCount: orders.length,
    spentSar: orders.reduce((total, order) => total + Number(order.price_sar || 0), 0),
    robuxReceived: orders.reduce((total, order) => total + Number(order.robux_amount || 0), 0),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
