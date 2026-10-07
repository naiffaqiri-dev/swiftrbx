import { get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { requirePopupAnnouncementOwner, getPopupAnnouncementViewer } from '@/lib/popup-announcement-auth'
import { audienceMatchesAnnouncement, isPopupAnnouncementInSchedule, type PopupAnnouncement } from '@/lib/popup-announcements'

const PATH_PREFIX = 'popup-announcements/'

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.searchParams.get('pathname')
  if (!pathname || !pathname.startsWith(PATH_PREFIX) || pathname.includes('..') || pathname.length > 300) {
    return NextResponse.json({ error: 'الصورة غير موجودة' }, { status: 404 })
  }

  const owner = await requirePopupAnnouncementOwner()
  const isOwner = !('response' in owner)
  if (!isOwner) {
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

    const { data: campaigns, error } = await admin
      .from('popup_announcements')
      .select('id,title,subject,kind,audience,steps,starts_at,ends_at,active,priority,created_at')
      .eq('active', true)
    const now = Date.now()
    const imageIsPublished = !error && ((campaigns ?? []) as PopupAnnouncement[]).some((campaign) =>
      isPopupAnnouncementInSchedule(campaign, now) &&
      audienceMatchesAnnouncement(campaign.audience, isCustomer) &&
      campaign.steps.some((step) => {
        try {
          const url = new URL(step.imageUrl, request.nextUrl.origin)
          return url.pathname === '/api/popup-announcements/image' && url.searchParams.get('pathname') === pathname
        } catch {
          return false
        }
      }),
    )

    if (!imageIsPublished) {
      return NextResponse.json({ error: 'الصورة غير متاحة' }, { status: 404 })
    }
  }

  try {
    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })
    if (!result) return new NextResponse('Not found', { status: 404 })
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' },
      })
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'تعذّر تحميل الصورة' }, { status: 500 })
  }
}
