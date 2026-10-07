import { NextResponse } from 'next/server'
import {
  audienceMatchesAnnouncement,
  isPopupAnnouncementInSchedule,
  popupAnnouncementTargetsViewer,
  validPopupSessionId,
  type PopupAnnouncement,
} from '@/lib/popup-announcements'
import { getPopupAnnouncementViewer } from '@/lib/popup-announcement-auth'
import { isCompletedPurchaser } from '@/lib/popup-announcement-audience'

const ANNOUNCEMENT_COLUMNS = 'id,title,subject,kind,audience,target_roles,target_user_ids,target_emails,frequency,steps,starts_at,ends_at,active,priority,created_at'

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!validPopupSessionId(sessionId)) {
    return NextResponse.json({ error: 'جلسة العرض غير صالحة' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
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
      return NextResponse.json({ error: 'تعذّر التحقق من المستخدم' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
    profile = data
    if (!profile?.active) {
      return NextResponse.json({ announcements: [] }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
  }

  const { data, error } = await admin
    .from('popup_announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'تعذّر تحميل الإعلانات' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  const now = Date.now()
  const campaigns = (data ?? []) as PopupAnnouncement[]
  const hasPurchaserCampaign = campaigns.some((campaign) => campaign.audience === 'purchasers')
  const isPurchaser = Boolean(
    user && profile?.role === 'user' && hasPurchaserCampaign && await isCompletedPurchaser(user.id),
  )
  const viewer = {
    id: user?.id,
    role: profile?.role,
    email: profile?.email ?? user?.email,
  }
  const eligible = campaigns.filter((campaign) =>
    isPopupAnnouncementInSchedule(campaign, now) &&
    audienceMatchesAnnouncement(campaign.audience, profile?.role === 'user', isPurchaser) &&
    !(user && campaign.audience === 'guests') &&
    popupAnnouncementTargetsViewer(campaign, viewer),
  )

  if (!eligible.length) {
    return NextResponse.json({ announcements: [] }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const campaignIds = eligible.map((campaign) => campaign.id)
  const [profileViews, sessionViews] = await Promise.all([
    user
      ? admin.from('popup_announcement_events').select('announcement_id,created_at').eq('event_type', 'view').eq('profile_id', user.id).in('announcement_id', campaignIds).range(0, 24_999)
      : Promise.resolve({ data: [], error: null }),
    admin.from('popup_announcement_events').select('announcement_id,created_at').eq('event_type', 'view').eq('session_id', sessionId).in('announcement_id', campaignIds).range(0, 24_999),
  ])

  if (profileViews.error || sessionViews.error) {
    return NextResponse.json({ error: 'تعذّر التحقق من سجل العرض' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  const shown = eligible.filter((campaign) => {
    const profileHistory = (profileViews.data ?? []).filter((view) => view.announcement_id === campaign.id)
    const sessionHistory = (sessionViews.data ?? []).filter((view) => view.announcement_id === campaign.id)
    if (campaign.frequency === 'once') return user ? profileHistory.length === 0 : sessionHistory.length === 0
    if (campaign.frequency === 'daily') {
      const cutoff = now - 24 * 60 * 60 * 1000
      const history = user ? profileHistory : sessionHistory
      return !history.some((view) => Date.parse(view.created_at) >= cutoff)
    }
    return sessionHistory.length === 0
  })

  const announcements = shown.map(({ target_roles: _roles, target_user_ids: _users, target_emails: _emails, ...campaign }) => campaign)
  return NextResponse.json({ announcements }, { headers: { 'Cache-Control': 'private, no-store' } })
}
