import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  let body: { username?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')
  const email = String(body.email ?? '').trim().toLowerCase()

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: 'اسم المستخدم بالإنجليزية فقط (أحرف وأرقام و _)، من 3 إلى 20 خانة' },
      { status: 400 },
    )
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'البريد الإلكتروني مطلوب وصالح' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'كلمة المرور يجب ألا تقل عن 6 أحرف' }, { status: 400 })
  }

  const admin = createAdminClient()

  // التحقق من توفّر اسم المستخدم
  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle()
  if (taken) {
    return NextResponse.json({ error: 'اسم المستخدم مستخدم بالفعل' }, { status: 409 })
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  })

  if (error) {
    const msg = /already|registered|exists/i.test(error.message)
      ? 'البريد الإلكتروني مستخدم بالفعل'
      : 'تعذّر إنشاء الحساب، حاول مرة أخرى'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ email })
}
