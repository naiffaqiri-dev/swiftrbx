import { NextResponse } from 'next/server'
import { audienceMatchesAnnouncement, isPopupAnnouncementInSchedule, type PopupAnnouncement } from '@/lib/popup-announcements'
import { getPopupAnnouncementViewer } from '@/lib/popup-announcement-auth'

export async function GET() {
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

  const { data, error } = await admin
    .from('popup_announcements')
    .select('id,title,subject,kind,audience,steps,starts_at,ends_at,active,priority,created_at')
    .eq('active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'تعذّر تحميل الإعلانات' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  const now = Date.now()
  const announcements = ((data ?? []) as PopupAnnouncement[]).filter((campaign) =>
    isPopupAnnouncementInSchedule(campaign, now) && audienceMatchesAnnouncement(campaign.audience, isCustomer),
  )

  return NextResponse.json({ announcements }, { headers: { 'Cache-Control': 'private, no-store' } })
}
