import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function hasSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() ?? request.headers.get('host')
  if (!origin || !host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('discord_profile_sync_tokens')
    .select('enabled_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'تعذّر تحميل حالة المزامنة' }, { status: 500 })
  return NextResponse.json(
    { enabled: Boolean(data) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('discord_profile_sync_tokens')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'تعذّر إيقاف المزامنة' }, { status: 500 })
  return NextResponse.json({ enabled: false })
}
