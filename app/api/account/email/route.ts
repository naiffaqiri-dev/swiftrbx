import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, codeEmailHtml, generateCode } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  let body: { action?: string; newEmail?: string; code?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

  const admin = createAdminClient()

  if (body.action === 'request') {
    const newEmail = String(body.newEmail ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(newEmail)) {
      return NextResponse.json({ error: 'بريد إلكتروني غير صالح' }, { status: 400 })
    }
    // منع استخدام بريد مسجّل لحساب آخر
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .maybeSingle()
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: 'هذا البريد مستخدم بالفعل' }, { status: 409 })
    }

    const code = generateCode()
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await admin.from('verification_codes').delete().eq('user_id', user.id).eq('purpose', 'email_change')
    await admin.from('verification_codes').insert({
      user_id: user.id,
      purpose: 'email_change',
      code,
      new_email: newEmail,
      expires_at: expires,
    })

    const ok = await sendEmail(
      newEmail,
      'رمز تأكيد تغيير البريد — SwiftRBX',
      codeEmailHtml(code, 'رمز تأكيد تغيير بريدك الإلكتروني', 'الرمز صالح لمدة 10 دقائق. إن لم تطلب ذلك، تجاهل الرسالة.'),
    )
    if (!ok) {
      return NextResponse.json({ error: 'تعذّر إرسال رمز التحقق، حاول لاحقاً' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'confirm') {
    const code = String(body.code ?? '').trim()
    const { data: row } = await admin
      .from('verification_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('purpose', 'email_change')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!row || row.code !== code) {
      return NextResponse.json({ error: 'رمز التحقق غير صحيح' }, { status: 400 })
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز، اطلب رمزاً جديداً' }, { status: 400 })
    }

    const newEmail = row.new_email as string
    const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
      email: newEmail,
      email_confirm: true,
    })
    if (authErr) {
      return NextResponse.json({ error: 'تعذّر تحديث البريد' }, { status: 500 })
    }
    await admin.from('profiles').update({ email: newEmail }).eq('id', user.id)
    await admin.from('verification_codes').delete().eq('user_id', user.id).eq('purpose', 'email_change')

    return NextResponse.json({ ok: true, email: newEmail })
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
}
