import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { USERNAME_RE } from '@/lib/password'

const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000 // شهر
const DISPLAY_NAME_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000 // 3 أيام

function daysLeft(sinceIso: string | null, cooldownMs: number): number {
  if (!sinceIso) return 0
  const elapsed = Date.now() - Date.parse(sinceIso)
  if (elapsed >= cooldownMs) return 0
  return Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000))
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, email, balance, commission, two_factor_enabled, referral_code')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'تعذّر تحميل بيانات الحساب' }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json({ error: 'الملف الشخصي غير موجود' }, { status: 404 })
  }

  return NextResponse.json(
    {
      profile: {
        id: profile.id,
        email: profile.email,
        balance: Number(profile.balance ?? 0),
        commission: Number(profile.commission ?? 0),
        two_factor_enabled: !!profile.two_factor_enabled,
        referral_code: profile.referral_code,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  let body: { action?: string; value?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const action = String(body.action ?? '')
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('username, display_name, username_changed_at, display_name_changed_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'الملف الشخصي غير موجود' }, { status: 404 })
  }

  // ─── تغيير اسم المستخدم: مرة واحدة كل شهر ───
  if (action === 'username') {
    const username = String(body.value ?? '').trim()
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: 'اسم المستخدم بالإنجليزية فقط (أحرف وأرقام و _)، من 2 إلى 16 خانة' },
        { status: 400 },
      )
    }
    if (username.toLowerCase() !== profile.username?.toLowerCase()) {
      const left = daysLeft(profile.username_changed_at, USERNAME_COOLDOWN_MS)
      if (left > 0) {
        return NextResponse.json(
          { error: `يمكنك تغيير اسم المستخدم مرة واحدة شهرياً. المتبقي: ${left} يوم` },
          { status: 429 },
        )
      }
      const { data: taken } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .neq('id', user.id)
        .maybeSingle()
      if (taken) {
        return NextResponse.json({ error: 'اسم المستخدم مستخدم بالفعل' }, { status: 409 })
      }
      const { error } = await admin
        .from('profiles')
        .update({ username, username_changed_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) {
        return NextResponse.json({ error: 'تعذّر حفظ اسم المستخدم' }, { status: 400 })
      }
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, username },
      })
    }
    return NextResponse.json({ ok: true, username, changedAt: Date.now() })
  }

  // ─── تغيير الاسم المستعار: مرة واحدة كل 3 أيام ───
  if (action === 'displayName') {
    const displayName = String(body.value ?? '').trim()
    if (displayName.length < 2 || displayName.length > 24) {
      return NextResponse.json({ error: 'الاسم المستعار من 2 إلى 24 حرفاً' }, { status: 400 })
    }
    if (displayName !== (profile.display_name ?? '')) {
      const left = daysLeft(profile.display_name_changed_at, DISPLAY_NAME_COOLDOWN_MS)
      if (left > 0) {
        return NextResponse.json(
          { error: `يمكنك تغيير الاسم المستعار مرة واحدة كل 3 أيام. المتبقي: ${left} يوم` },
          { status: 429 },
        )
      }
      const { error } = await admin
        .from('profiles')
        .update({ display_name: displayName, display_name_changed_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) {
        return NextResponse.json({ error: 'تعذّر حفظ الاسم المستعار' }, { status: 400 })
      }
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, display_name: displayName },
      })
    }
    return NextResponse.json({ ok: true, displayName, changedAt: Date.now() })
  }

  // ─── تحديث الصورة الشخصية: بلا حد زمني ───
  if (action === 'avatar') {
    const avatarUrl = String(body.value ?? '').trim()
    if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) {
      return NextResponse.json({ error: 'رابط الصورة غير صالح' }, { status: 400 })
    }
    const { error } = await admin
      .from('profiles')
      .update({ avatar_url: avatarUrl || null })
      .eq('id', user.id)
    if (error) {
      return NextResponse.json({ error: 'تعذّر حفظ الصورة' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, avatarUrl })
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
}
