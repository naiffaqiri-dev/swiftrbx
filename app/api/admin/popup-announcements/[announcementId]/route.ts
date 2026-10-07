import { NextResponse } from 'next/server'
import { requirePopupAnnouncementOwner } from '@/lib/popup-announcement-auth'
import { isPopupAnnouncementId, validatePopupAnnouncementDraft } from '@/lib/popup-announcements'

const CAMPAIGN_COLUMNS = 'id,title,subject,kind,audience,target_roles,target_user_ids,target_emails,frequency,steps,starts_at,ends_at,active,priority,created_at'

type RouteContext = { params: Promise<{ announcementId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const owner = await requirePopupAnnouncementOwner()
  if ('response' in owner) return owner.response

  const { announcementId } = await context.params
  if (!isPopupAnnouncementId(announcementId)) {
    return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'بيانات التحديث غير صالحة' }, { status: 400 })
  }

  const patch = body as Record<string, unknown>
  let update: Record<string, unknown>
  if (Object.keys(patch).length === 1 && typeof patch.active === 'boolean') {
    update = { active: patch.active }
  } else {
    const draft = validatePopupAnnouncementDraft(body)
    if (!draft) {
      return NextResponse.json({ error: 'تحقق من بيانات الحملة والروابط والتوقيت' }, { status: 400 })
    }
    update = draft
  }

  const { data, error } = await owner.admin
    .from('popup_announcements')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', announcementId)
    .select(CAMPAIGN_COLUMNS)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'تعذّر تحديث الحملة' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
  }

  return NextResponse.json({ announcement: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const owner = await requirePopupAnnouncementOwner()
  if ('response' in owner) return owner.response

  const { announcementId } = await context.params
  if (!isPopupAnnouncementId(announcementId)) {
    return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
  }

  const { error, count } = await owner.admin
    .from('popup_announcements')
    .delete({ count: 'exact' })
    .eq('id', announcementId)

  if (error) {
    return NextResponse.json({ error: 'تعذّر حذف الحملة' }, { status: 500 })
  }
  if (count === 0) {
    return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
