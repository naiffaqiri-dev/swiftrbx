import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, codeEmailHtml, generateCode } from '@/lib/email'

const SYNTH_DOMAIN = '@users.swiftrbx.site'

export async function POST(req: Request) {
  let body: { action?: string; enable?: boolean; code?: string }
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
  const purpose = body.enable ? '2fa_enable' : '2fa_disable'

  if (body.action === 'request') {
    const email = user.email ?? ''
    if (!email || email.endsWith(SYNTH_DOMAIN)) {
      return NextResponse.json(
        { error: 'أضف بريداً إلكترونياً حقيقياً في ملفك أولاً لتفعيل التحقق بخطوتين' },
        { status: 400 },
      )
    }

    const code = generateCode()
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await admin.from('verification_codes').delete().eq('user_id', user.id).eq('purpose', purpose)
    await admin.from('verification_codes').insert({
      user_id: user.id,
      purpose,
      code,
      expires_at: expires,
    })

    const ok = await sendEmail(
      email,
      'رمز التحقق بخطوتين — SwiftRBX',
      codeEmailHtml(
        code,
        body.enable ? 'رمز تفعيل التحقق بخطوتين' : 'رمز تعطيل التحقق بخطوتين',
        'الرمز صالح لمدة 10 دقائق.',
      ),
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
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!row || row.code !== code) {
      return NextResponse.json({ error: 'رمز التحقق غير صحيح' }, { status: 400 })
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز، اطلب رمزاً جديداً' }, { status: 400 })
    }

    await admin.from('profiles').update({ two_factor_enabled: !!body.enable }).eq('id', user.id)
    await admin.from('verification_codes').delete().eq('user_id', user.id).eq('purpose', purpose)

    return NextResponse.json({ ok: true, enabled: !!body.enable })
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
}
