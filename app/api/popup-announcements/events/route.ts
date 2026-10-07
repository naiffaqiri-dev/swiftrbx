import { NextResponse } from 'next/server'
import {
  audienceMatchesAnnouncement,
  isPopupAnnouncementInSchedule,
  isPopupAnnouncementId,
  isPopupAnnouncementEvent,
  isPopupAnnouncementKind,
  isSafePopupChoice,
  isSafePopupStepIndex,
  validPopupSessionId,
  type PopupAnnouncement,
} from '@/lib/popup-announcements'
import { getPopupAnnouncementViewer } from '@/lib/popup-announcement-auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'بيانات التفاعل غير صالحة' }, { status: 400 })
  }

  const event = body as Record<string, unknown>
  if (
    !isPopupAnnouncementId(event.announcementId) ||
    !validPopupSessionId(event.sessionId) ||
    !isPopupAnnouncementEvent(event.eventType)
  ) {
    return NextResponse.json({ error: 'بيانات التفاعل غير صالحة' }, { status: 400 })
  }

  const { user, admin } = await getPopupAnnouncementViewer()
  let isCustomer = false
  if (user) {
    const { data: profile } = await admin
      .from('profiles')
      .select('role,active')
      .eq('id', user.id)
      .maybeSingle()
    isCustomer = profile?.role === 'user' && profile.active !== false
  }

  const { data: campaign, error: campaignError } = await admin
    .from('popup_announcements')
    .select('id,title,subject,kind,audience,steps,starts_at,ends_at,active,priority,created_at')
    .eq('id', event.announcementId)
    .eq('active', true)
    .maybeSingle()

  if (campaignError) {
    return NextResponse.json({ error: 'تعذّر تسجيل التفاعل' }, { status: 500 })
  }
  if (!campaign || !isPopupAnnouncementInSchedule(campaign as PopupAnnouncement) || !audienceMatchesAnnouncement(campaign.audience, isCustomer)) {
    return NextResponse.json({ error: 'الإعلان غير متاح' }, { status: 404 })
  }

  const announcement = campaign as PopupAnnouncement
  if (!isSafePopupStepIndex(event.stepIndex, announcement.steps.length)) {
    return NextResponse.json({ error: 'الخطوة غير صالحة' }, { status: 400 })
  }

  let choice: string | null = null
  if (event.eventType === 'poll') {
    const step = announcement.steps[event.stepIndex]
    if (
      !isPopupAnnouncementKind(announcement.kind) || announcement.kind !== 'survey' ||
      !isSafePopupChoice(event.choice) || !step.options.includes(event.choice)
    ) {
      return NextResponse.json({ error: 'خيار التصويت غير صالح' }, { status: 400 })
    }
    choice = event.choice

    const { data: previousVote, error: voteLookupError } = await admin
      .from('popup_announcement_events')
      .select('id')
      .eq('announcement_id', announcement.id)
      .eq('session_id', event.sessionId)
      .eq('event_type', 'poll')
      .limit(1)
      .maybeSingle()

    if (voteLookupError) {
      return NextResponse.json({ error: 'تعذّر تسجيل التصويت' }, { status: 500 })
    }
    if (previousVote) {
      return NextResponse.json({ success: true, alreadyRecorded: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
  }

  if (event.eventType === 'view') {
    const { data: previousView, error: viewLookupError } = await admin
      .from('popup_announcement_events')
      .select('id')
      .eq('announcement_id', announcement.id)
      .eq('session_id', event.sessionId)
      .eq('event_type', 'view')
      .limit(1)
      .maybeSingle()

    if (viewLookupError) {
      return NextResponse.json({ error: 'تعذّر تسجيل المشاهدة' }, { status: 500 })
    }
    if (previousView) {
      return NextResponse.json({ success: true, alreadyRecorded: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
  }

  const { error } = await admin.from('popup_announcement_events').insert({
    announcement_id: announcement.id,
    session_id: event.sessionId,
    event_type: event.eventType,
    step_index: event.stepIndex,
    choice,
  })

  if (error) {
    return NextResponse.json({ error: 'تعذّر تسجيل التفاعل' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
