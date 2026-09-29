import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminContext =
  | { ok: true; admin: ReturnType<typeof createAdminClient>; userId: string }
  | { ok: false; error: 'unauthorized' | 'forbidden' }

async function requireAdmin(): Promise<AdminContext> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, active').eq('id', user.id).maybeSingle()
  if (!profile?.active || !['owner', 'admin'].includes(profile.role)) return { ok: false, error: 'forbidden' }
  return { ok: true, admin, userId: user.id }
}

function authError(error: 'unauthorized' | 'forbidden') {
  return NextResponse.json({ error: error === 'unauthorized' ? 'سجّل الدخول أولاً' : 'غير مصرّح' }, { status: error === 'unauthorized' ? 401 : 403 })
}

export async function GET() {
  const context = await requireAdmin()
  if (!context.ok) return authError(context.error)
  const { data: maps, error } = await context.admin.from('marketplace_games')
    .select('id, name, emoji, active, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'تعذّر تحميل فئات المابات' }, { status: 500 })
  return NextResponse.json({ maps: maps ?? [] })
}

export async function POST(request: Request) {
  const context = await requireAdmin()
  if (!context.ok) return authError(context.error)
  const body = await request.json().catch(() => null) as { name?: unknown } | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name.length < 2 || name.length > 60 || /[%_]/.test(name)) {
    return NextResponse.json({ error: 'اسم الماب يجب أن يكون بين حرفين و60 حرفاً' }, { status: 400 })
  }

  const { data: existing, error: lookupError } = await context.admin.from('marketplace_games').select('name')
  if (lookupError) return NextResponse.json({ error: 'تعذّر التحقق من اسم الماب' }, { status: 500 })
  if (existing?.some((map) => map.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return NextResponse.json({ error: 'هذا الماب مضاف بالفعل' }, { status: 409 })
  }

  const { data: map, error } = await context.admin.from('marketplace_games').insert({
    name,
    created_by: context.userId,
  }).select('id, name, emoji, active, created_at').single()
  if (error) return NextResponse.json({ error: 'تعذّرت إضافة الماب' }, { status: 500 })
  return NextResponse.json({ map }, { status: 201 })
}

export async function PATCH(request: Request) {
  const context = await requireAdmin()
  if (!context.ok) return authError(context.error)
  const body = await request.json().catch(() => null) as { id?: unknown; active?: unknown } | null
  if (typeof body?.id !== 'string' || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }
  const { data, error } = await context.admin.from('marketplace_games')
    .update({ active: body.active, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'تعذّر تحديث حالة الماب' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'الماب غير موجود' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
