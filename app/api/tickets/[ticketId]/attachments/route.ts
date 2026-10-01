import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

type RouteContext = { params: Promise<{ ticketId: string }> }

async function authorizeTicket(ticketId: string, userId: string) {
  const admin = createAdminClient()
  const [{ data: ticket }, { data: profile }] = await Promise.all([
    admin.from('tickets').select('id, type, buyer_id, seller_id').eq('id', ticketId).maybeSingle(),
    admin.from('profiles').select('role, active').eq('id', userId).maybeSingle(),
  ])

  const isParticipant = ticket?.buyer_id === userId || ticket?.seller_id === userId
  const isPrivilegedStaff = ['owner', 'admin'].includes(profile?.role ?? '')
  const isSupportStaff = profile?.role === 'support' && ['support', 'dispute'].includes(ticket?.type ?? '')
  const isActive = profile?.active !== false

  return {
    admin,
    ticket,
    authorized: Boolean(ticket && isActive && (isParticipant || isPrivilegedStaff || isSupportStaff)),
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول لإرفاق صورة' }, { status: 401 })

  const { ticketId } = await params
  const { admin, authorized } = await authorizeTicket(ticketId, user.id)
  if (!authorized) return NextResponse.json({ error: 'لا تملك صلاحية إرفاق صورة لهذا الطلب' }, { status: 403 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'اختر صورة لإرفاقها' }, { status: 400 })

  const extension = IMAGE_EXTENSIONS[file.type]
  if (!extension) return NextResponse.json({ error: 'صيغة الصورة غير مدعومة' }, { status: 400 })
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'حجم الصورة يجب ألا يتجاوز 8 ميغابايت' }, { status: 400 })
  }

  try {
    const objectPath = `${ticketId}/supabase/${crypto.randomUUID()}.${extension}`
    const { error } = await admin.storage
      .from('ticket-attachments')
      .upload(objectPath, file, { contentType: file.type, upsert: false })
    if (error) throw error

    return NextResponse.json({ pathname: `ticket-attachments/${objectPath}` }, { status: 201 })
  } catch (cause) {
    console.error('[ticket-attachments] Supabase Storage upload failed', cause)
    return NextResponse.json({ error: 'تعذّر رفع الصورة، حاول مرة أخرى' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { ticketId } = await params
  const pathname = request.nextUrl.searchParams.get('pathname')
  const expectedPrefix = `ticket-attachments/${ticketId}/`
  if (!pathname || !pathname.startsWith(expectedPrefix) || pathname.includes('..')) {
    return NextResponse.json({ error: 'الصورة غير موجودة' }, { status: 404 })
  }

  const { admin, authorized } = await authorizeTicket(ticketId, user.id)
  if (!authorized) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

  try {
    if (pathname.startsWith(`${expectedPrefix}supabase/`)) {
      const objectPath = pathname.slice(expectedPrefix.length)
      const { data, error } = await admin.storage.from('ticket-attachments').download(objectPath)
      if (error || !data) return NextResponse.json({ error: 'الصورة غير موجودة' }, { status: 404 })

      return new NextResponse(data, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': data.type || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    const blob = await get(pathname, { access: 'private' })
    if (!blob) return NextResponse.json({ error: 'الصورة غير موجودة' }, { status: 404 })

    return new NextResponse(blob.stream, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': blob.blob.contentType ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (cause) {
    console.error('[ticket-attachments] Image download failed', cause)
    return NextResponse.json({ error: 'تعذّر تحميل الصورة' }, { status: 500 })
  }
}
