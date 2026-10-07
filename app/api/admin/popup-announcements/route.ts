import { NextResponse } from 'next/server'
import { requirePopupAnnouncementOwner } from '@/lib/popup-announcement-auth'
import { validatePopupAnnouncementDraft } from '@/lib/popup-announcements'

const CAMPAIGN_COLUMNS = 'id,title,subject,kind,audience,target_roles,target_user_ids,target_emails,frequency,steps,starts_at,ends_at,active,priority,created_at'

export async function GET() {
  const owner = await requirePopupAnnouncementOwner()
  if ('response' in owner) return owner.response

  const { data: campaigns, error } = await owner.admin
    .from('popup_announcements')
    .select(CAMPAIGN_COLUMNS)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'تعذّر تحميل الحملات' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  const ids = (campaigns ?? []).map((campaign) => campaign.id)
  const eventsResult = ids.length
    ? await owner.admin
        .from('popup_announcement_events')
        .select('announcement_id,event_type')
        .in('announcement_id', ids)
        .range(0, 24_999)
    : { data: [], error: null }

  if (eventsResult.error) {
    return NextResponse.json({ error: 'تعذّر تحميل إحصاءات الحملات' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  const metrics = new Map<string, { views: number; clicks: number; completions: number; polls: number }>()
  for (const campaign of campaigns ?? []) metrics.set(campaign.id, { views: 0, clicks: 0, completions: 0, polls: 0 })
  for (const event of eventsResult.data ?? []) {
    const campaignMetrics = metrics.get(event.announcement_id)
    if (!campaignMetrics) continue
    if (event.event_type === 'view') campaignMetrics.views += 1
    if (event.event_type === 'click') campaignMetrics.clicks += 1
    if (event.event_type === 'complete') campaignMetrics.completions += 1
    if (event.event_type === 'poll') campaignMetrics.polls += 1
  }

  return NextResponse.json({
    announcements: (campaigns ?? []).map((campaign) => ({ ...campaign, metrics: metrics.get(campaign.id) })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const owner = await requirePopupAnnouncementOwner()
  if ('response' in owner) return owner.response

  const body = await request.json().catch(() => null)
  const draft = validatePopupAnnouncementDraft(body)
  if (!draft) {
    return NextResponse.json({ error: 'تحقق من بيانات الحملة والروابط والتوقيت' }, { status: 400 })
  }

  const { data, error } = await owner.admin
    .from('popup_announcements')
    .insert({ ...draft, created_by: owner.userId })
    .select(CAMPAIGN_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: 'تعذّر حفظ الحملة' }, { status: 500 })
  }

  return NextResponse.json({ announcement: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
