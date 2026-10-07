import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function requirePopupAnnouncementOwner() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()

  if (!user) {
    return { response: NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { response: NextResponse.json({ error: 'تعذّر التحقق من الصلاحية' }, { status: 500 }) }
  }
  if (profile?.role !== 'owner' || profile.active === false) {
    return { response: NextResponse.json({ error: 'غير مصرّح' }, { status: 403 }) }
  }

  return { admin, userId: user.id }
}

export async function getPopupAnnouncementViewer() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  return { user, admin: createAdminClient() }
}
