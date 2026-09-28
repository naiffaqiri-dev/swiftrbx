import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAssignCatalogPermissions, type CatalogCategory } from '@/lib/catalog'

const OWNER_EMAIL = 'naif.faqiri@gmail.com'

export async function PATCH(request: Request) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { userId?: string; permissions?: unknown } | null
  if (!body?.userId || !canAssignCatalogPermissions(body.permissions)) {
    return NextResponse.json({ error: 'بيانات الصلاحيات غير صالحة' }, { status: 400 })
  }

  const permissions = [...new Set(body.permissions)] as CatalogCategory[]
  const admin = createAdminClient()
  const { error } = await admin.from('profiles')
    .update({ seller_permissions: permissions })
    .eq('id', body.userId)
  if (error) return NextResponse.json({ error: 'تعذّر حفظ الصلاحيات' }, { status: 500 })
  return NextResponse.json({ ok: true, permissions })
}
