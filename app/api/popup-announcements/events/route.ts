import { NextResponse } from 'next/server'
import {
  audienceMatchesAnnouncement,
  isPopupAnnouncementInSchedule,
  isPopupAnnouncementId,
  isPopupAnnouncementEvent,
  isPopupAnnouncementKind,
  isSafePopupChoice,
  isSafePopupStepIndex,
  popupAnnouncementTargetsViewer,
  validPopupSessionId,
  type PopupAnnouncement,
} from '@/lib/popup-announcements'
import { getPopupAnnouncementViewer } from '@/lib/popup-announcement-auth'

const ANNOUNCEMENT_COLUMNS = 'id,title,subject,kind,audience,target_roles,target_user_ids,target_emails,frequency,steps,starts_at,ends_at,active,priority,created_at'

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
  let profile: { role: string; active: boolean; email: string | null } | null = null
  if (user) {
    const { data, error: profileError } = await admin
      .from('profiles')
      .select('role,active,email')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) {
      return NextResponse.json({ error: 'تعذّر التحقق من المستخدم' }, { status: 500 })
    }
    profile = data
    if (profile?.active === false) {
      return NextResponse.json({ error: 'الإعلان غير متاح' }, { status: 404 })
    }
  }

  const { data: campaign, error: campaignError } = await admin
    .from('popup_announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('id', event.announcementId)
    .eq('active', true)
    .maybeSingle()

  if (campaignError) {
    return NextResponse.json({ error: 'تعذّر تسجيل التفاعل' }, { status: 500 })
  }
  const announcement = campaign as PopupAnnouncement | null
  const isCustomer = profile?.role === 'user' && profile.active
  if (
    !announcement ||
    !isPopupAnnouncementInSchedule(announcement) ||
    !audienceMatchesAnnouncement(announcement.audience, isCustomer) ||
    (user && announcement.audience === 'guests') ||
    !popupAnnouncementTargetsViewer(announcement, { id: user?.id, role: profile?.role, email: profile?.email ?? user?.email })
  ) {
    return NextResponse.json({ error: 'الإعلان غير متاح' }, { status: 404 })
  }

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
    let viewLookup = admin
      .from('popup_announcement_events')
      .select('id')
      .eq('announcement_id', announcement.id)
      .eq('event_type', 'view')

    if (user && profile && announcement.frequency !== 'session') {
      viewLookup = viewLookup.eq('profile_id', user.id)
      if (announcement.frequency === 'daily') {
        viewLookup = viewLookup.gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      }
    } else {
      viewLookup = viewLookup.eq('session_id', event.sessionId)
    }

    const { data: previousView, error: viewLookupError } = await viewLookup.limit(1).maybeSingle()
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
    profile_id: user && profile ? user.id : null,
    event_type: event.eventType,
    step_index: event.stepIndex,
    choice,
  })

  if (error) {
    return NextResponse.json({ error: 'تعذّر تسجيل التفاعل' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
