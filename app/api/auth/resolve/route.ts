import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// يحوّل اسم المستخدم إلى البريد المرتبط به حتى نسجّل الدخول عبر Supabase (الذي يتطلب بريداً).
export async function POST(req: Request) {
  let body: { identifier?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const identifier = String(body.identifier ?? '').trim()
  if (!identifier) {
    return NextResponse.json({ error: 'مطلوب' }, { status: 400 })
  }

  if (identifier.includes('@')) {
    return NextResponse.json({ email: identifier.toLowerCase() })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('email')
    .ilike('username', identifier)
    .maybeSingle()

  if (!data?.email) {
    return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 })
  }

  return NextResponse.json({ email: data.email })
}
