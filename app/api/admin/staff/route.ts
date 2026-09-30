import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OWNER_EMAIL = 'naif.faqiri@gmail.com'
const ALLOWED_ROLES = ['seller', 'support', 'user'] as const
type StaffRole = (typeof ALLOWED_ROLES)[number]

function synthEmail(username: string) {
  return `${username.toLowerCase()}@staff.swiftrbx.site`
}

function tempPassword() {
  return `Swift-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: actor, error: actorError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (actorError || actor?.role !== 'owner') {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  }

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, balance')
    .neq('role', 'owner')
  if (error) {
    return NextResponse.json({ error: 'تعذّر تحميل بيانات الموظفين' }, { status: 500 })
  }

  return NextResponse.json(
    {
      users: (profiles ?? []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        balance: Number(profile.balance ?? 0),
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(req: Request) {
  // التحقق أن الطالب هو المالك فقط
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  }

  let body: { username?: string; email?: string; role?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const username = String(body.username ?? '').trim()
  const role = String(body.role ?? '') as StaffRole
  const rawEmail = String(body.email ?? '').trim().toLowerCase()

  if (username.length < 2) {
    return NextResponse.json({ error: 'اسم المستخدم قصير' }, { status: 400 })
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'دور غير صالح' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle()
  if (taken) {
    return NextResponse.json({ error: 'اسم المستخدم مستخدم بالفعل' }, { status: 409 })
  }

  const email = rawEmail || synthEmail(username)
  const password = String(body.password ?? '') || tempPassword()

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  })
  if (error || !created.user) {
    const msg = /already|registered|exists/i.test(error?.message ?? '')
      ? 'البريد الإلكتروني مستخدم بالفعل'
      : 'تعذّر إنشاء الحساب'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // تعيين الدور المطلوب (المحفّز ينشئ البروفايل بدور user افتراضياً)
  const { error: roleError } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', created.user.id)
  if (roleError) {
    return NextResponse.json({ error: 'تم إنشاء الحساب لكن تعذّر تعيين الدور' }, { status: 500 })
  }

  return NextResponse.json({ email, tempPassword: password })
}
