import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { USERNAME_RE, validatePassword } from '@/lib/password'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  let body: { username?: string; displayName?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const username = String(body.username ?? '').trim()
  const displayName = String(body.displayName ?? '').trim()
  const password = String(body.password ?? '')
  const email = String(body.email ?? '').trim().toLowerCase()

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: 'اسم المستخدم بالإنجليزية فقط (أحرف وأرقام و _)، من 2 إلى 16 خانة' },
      { status: 400 },
    )
  }
  if (displayName.length < 2 || displayName.length > 24) {
    return NextResponse.json({ error: 'الاسم المستعار من 2 إلى 24 حرفاً' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'البريد الإلكتروني مطلوب وصالح' }, { status: 400 })
  }
  const pwError = validatePassword(password)
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 })
  }

  const admin = createAdminClient()

  // اسم المستخدم يجب ألا يكون مستخدماً من قبل شخص آخر
  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .neq('id', user.id)
    .maybeSingle()
  if (taken) {
    return NextResponse.json({ error: 'اسم المستخدم مستخدم بالفعل' }, { status: 409 })
  }

  // ضبط كلمة المرور والبريد على حساب المصادقة (يتيح تسجيل الدخول اليدوي لاحقاً)
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email,
    email_confirm: true,
    user_metadata: { ...user.user_metadata, username, display_name: displayName },
  })
  if (authErr) {
    const msg = /already|registered|exists/i.test(authErr.message)
      ? 'البريد الإلكتروني مستخدم بالفعل'
      : 'تعذّر حفظ البيانات، حاول مرة أخرى'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { error: profErr } = await admin
    .from('profiles')
    .update({
      username,
      display_name: displayName,
      email,
      onboarded: true,
    })
    .eq('id', user.id)

  if (profErr) {
    return NextResponse.json({ error: 'تعذّر حفظ الملف الشخصي' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
