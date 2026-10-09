import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { USERNAME_RE, validatePassword } from '@/lib/password'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  let body: {
    username?: string
    displayName?: string
    email?: string
    password?: string
    privacyPolicyAccepted?: boolean
    termsOfUseAccepted?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const username = String(body.username ?? '').trim()
  const displayName = String(body.displayName ?? '').trim()
  const password = String(body.password ?? '')
  const email = String(body.email ?? '').trim().toLowerCase()

  if (body.privacyPolicyAccepted !== true || body.termsOfUseAccepted !== true) {
    return NextResponse.json(
      { error: 'يجب قبول سياسة الخصوصية وشروط الاستخدام لإنشاء الحساب' },
      { status: 400 },
    )
  }

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

  // التحقق من توفّر اسم المستخدم
  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle()
  if (taken) {
    return NextResponse.json({ error: 'اسم المستخدم مستخدم بالفعل' }, { status: 409 })
  }

  const acceptedAt = new Date().toISOString()
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: displayName },
    app_metadata: {
      privacy_policy_accepted_at: acceptedAt,
      terms_of_use_accepted_at: acceptedAt,
    },
  })

  if (error) {
    const msg = /already|registered|exists/i.test(error.message)
      ? 'البريد الإلكتروني مستخدم بالفعل'
      : 'تعذّر إنشاء الحساب، حاول مرة أخرى'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ email })
}
