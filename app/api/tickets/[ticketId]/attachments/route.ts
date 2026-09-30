import { get, put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const
const TICKET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getAuthorizedTicket(ticketId: string, userId: string) {
  const admin = createAdminClient()
  const [{ data: ticket }, { data: profile }] = await Promise.all([
    admin.from('tickets').select('buyer_id, seller_id').eq('id', ticketId).maybeSingle(),
    admin.from('profiles').select('role').eq('id', userId).maybeSingle(),
  ])

  const isStaff = ['owner', 'admin', 'support'].includes(profile?.role ?? '')
  const isParticipant = ticket?.buyer_id === userId || ticket?.seller_id === userId
  return ticket && (isStaff || isParticipant) ? { admin, ticket } : null
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const requestHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !requestHost) return false
  try {
    return new URL(origin).host === requestHost
  } catch {
    return false
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  if (!TICKET_ID_PATTERN.test(ticketId)) {
    return NextResponse.json({ error: 'التذكرة غير متاحة' }, { status: 404 })
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })

  const authorized = await getAuthorizedTicket(ticketId, user.id)
  if (!authorized) return NextResponse.json({ error: 'التذكرة غير متاحة' }, { status: 404 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'ملف الصورة غير صالح' }, { status: 400 })
  }

  const file = formData.get('file')
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000)
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'يرجى اختيار صورة' }, { status: 400 })
  }
  const extension = Object.entries(IMAGE_TYPES).find(([type]) => type === file.type)?.[1]
  if (!extension) {
    return NextResponse.json({ error: 'الصيغ المدعومة: JPG وPNG وWebP وGIF' }, { status: 415 })
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت' }, { status: 413 })
  }

  const pathname = `tickets/${ticketId}/${user.id}/${crypto.randomUUID()}.${extension}`
  let blobUrl: string
  try {
    const blob = await put(pathname, file, { access: 'private', contentType: file.type, addRandomSuffix: false })
    blobUrl = blob.url
  } catch {
    return NextResponse.json({ error: 'تعذّر رفع الصورة حالياً، حاول مرة أخرى' }, { status: 502 })
  }

  const imageUrl = `/api/tickets/${ticketId}/attachments?pathname=${encodeURIComponent(pathname)}`
  const messageBody = [body, `![صورة مرفقة](${imageUrl})`].filter(Boolean).join('\n\n')
  const { data: message, error } = await authorized.admin
    .from('ticket_messages')
    .insert({ ticket_id: ticketId, sender_id: user.id, body: messageBody })
    .select('id, ticket_id, sender_id, body, created_at')
    .single()

  if (error || !message) {
    const { del } = await import('@vercel/blob')
    await del(blobUrl).catch(() => {})
    return NextResponse.json({ error: 'تعذّر إرسال الصورة، حاول مرة أخرى' }, { status: 500 })
  }

  await authorized.admin.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)
  return NextResponse.json({ message }, { status: 201 })
}

export async function GET(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  if (!TICKET_ID_PATTERN.test(ticketId)) {
    return NextResponse.json({ error: 'الصورة غير متاحة' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })

  const authorized = await getAuthorizedTicket(ticketId, user.id)
  if (!authorized) return NextResponse.json({ error: 'الصورة غير متاحة' }, { status: 404 })

  const pathname = new URL(request.url).searchParams.get('pathname')
  const allowedPath = new RegExp(`^tickets/${ticketId}/${user.id}/[0-9a-f-]+\\.(jpg|png|webp|gif)$`, 'i')
  if (!pathname || !allowedPath.test(pathname)) {
    return NextResponse.json({ error: 'الصورة غير متاحة' }, { status: 404 })
  }

  try {
    const result = await get(pathname, { access: 'private' })
    if (!result) return NextResponse.json({ error: 'الصورة غير موجودة' }, { status: 404 })
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'تعذّر فتح الصورة' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'طريقة غير مدعومة' }, { status: 405 })
}

export async function HEAD(request: Request, context: { params: Promise<{ ticketId: string }> }) {
  const response = await GET(request, context)
  return new NextResponse(null, { status: response.status, headers: response.headers })
}

export async function PATCH() {
  return NextResponse.json({ error: 'طريقة غير مدعومة' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'طريقة غير مدعومة' }, { status: 405 })
}

export async function TRACE() {
  return NextResponse.json({ error: 'طريقة غير مدعومة' }, { status: 405 })
}

export async function CONNECT() {
  return NextResponse.json({ error: 'طريقة غير مدعومة' }, { status: 405 })
}
