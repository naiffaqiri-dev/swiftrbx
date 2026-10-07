import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requireAnnouncementOwner() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return { ok: false as const, status: 401 as const }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle()

  if (error || profile?.role !== 'owner' || !profile.active) {
    return { ok: false as const, status: 403 as const }
  }

  return { ok: true as const, admin, userId: user.id }
}

export function announcementAuthError(status: 401 | 403) {
  return status === 401 ? 'يرجى تسجيل الدخول' : 'هذه الصفحة متاحة للإدارة العليا فقط'
}

export function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}
