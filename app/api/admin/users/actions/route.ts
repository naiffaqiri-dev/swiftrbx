import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OWNER_EMAIL = 'naif.faqiri@gmail.com'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 })
  if (user.email?.toLowerCase() !== OWNER_EMAIL) return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })

  const admin = createAdminClient()
  const { data: actor } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (actor?.role !== 'owner') return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  if (!UUID_PATTERN.test(userId) || userId === user.id) {
    return NextResponse.json({ error: 'حساب المستخدم غير صالح' }, { status: 400 })
  }

  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()
  if (targetError || !target || target.role === 'owner') {
    return NextResponse.json({ error: 'المستخدم غير موجود أو لا يمكن إدارة هذا الحساب' }, { status: 404 })
  }

  if (body?.action === 'balance_adjustment') {
    const amount = body.amount
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 9999999999.99 || Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json({ error: 'أدخل مبلغاً صحيحاً لا يساوي صفراً وبحد أقصى منزلتين عشريتين' }, { status: 400 })
    }
    if (reason.length < 5 || reason.length > 300) {
      return NextResponse.json({ error: 'سبب التعديل مطلوب (من 5 إلى 300 حرف)' }, { status: 400 })
    }

    const { data: balance, error } = await supabase.rpc('admin_adjust_user_balance', {
      p_target_user_id: userId,
      p_delta: amount,
      p_reason: reason,
    })
    if (error) {
      return NextResponse.json({ error: 'تعذّر تعديل الرصيد. تأكد من المبلغ والرصيد الحالي.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, balance: Number(balance) })
  }

  if (body?.action === 'support_view') {
    const { data: account, error } = await admin
      .from('profiles')
      .select('username, display_name, email, role, balance, active, created_at')
      .eq('id', userId)
      .maybeSingle()
    if (error || !account) return NextResponse.json({ error: 'تعذّر العثور على الحساب' }, { status: 404 })

    const { error: auditError } = await admin.from('admin_audit_log').insert({
      actor_id: user.id,
      actor_email: user.email.toLowerCase(),
      action: 'support_account_view',
      target_user_id: userId,
      metadata: { mode: 'read_only' },
    })
    if (auditError) return NextResponse.json({ error: 'تعذّر تسجيل عملية الوصول، لم يتم فتح الحساب' }, { status: 500 })

    return NextResponse.json({
      account: {
        username: account.username,
        displayName: account.display_name,
        email: account.email,
        role: account.role,
        balance: Number(account.balance ?? 0),
        active: account.active,
        createdAt: account.created_at,
      },
    })
  }

  return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 })
}

