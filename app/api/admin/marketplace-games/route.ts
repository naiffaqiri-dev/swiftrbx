import { randomUUID } from 'node:crypto'
import { del, put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

async function uploadThumbnail(image: FormDataEntryValue | null, userId: string) {
  if (!(image instanceof File) || image.size < 1 || image.size > MAX_THUMBNAIL_BYTES || !IMAGE_EXTENSIONS[image.type]) {
    return { error: 'اختر صورة PNG أو JPEG أو WebP أو AVIF بحجم أقصى 8 ميغابايت' as const }
  }

  const blob = await put(`marketplace-games/${userId}/${randomUUID()}.${IMAGE_EXTENSIONS[image.type]}`, image, {
    access: 'public',
    addRandomSuffix: false,
    contentType: image.type,
    cacheControlMaxAge: 31536000,
  })
  return { url: blob.url }
}

type AdminContext =
  | { ok: true; admin: ReturnType<typeof createAdminClient>; userId: string }
  | { ok: false; error: 'unauthorized' | 'forbidden' }

async function requireAdmin(): Promise<AdminContext> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, active').eq('id', user.id).maybeSingle()
  if (!profile?.active || !['owner', 'admin'].includes(profile.role)) return { ok: false, error: 'forbidden' }
  return { ok: true, admin, userId: user.id }
}

function authError(error: 'unauthorized' | 'forbidden') {
  return NextResponse.json({ error: error === 'unauthorized' ? 'سجّل الدخول أولاً' : 'غير مصرّح' }, { status: error === 'unauthorized' ? 401 : 403 })
}

export async function GET() {
  const context = await requireAdmin()
  if (!context.ok) return authError(context.error)
  const { data: maps, error } = await context.admin.from('marketplace_games')
    .select('id, name, emoji, thumbnail_url, active, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'تعذّر تحميل فئات المابات' }, { status: 500 })
  return NextResponse.json({ maps: maps ?? [] })
}

export async function POST(request: Request) {
  const context = await requireAdmin()
  if (!context.ok) return authError(context.error)
  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'نموذج غير صالح' }, { status: 400 })
  const name = String(form.get('name') ?? '').trim()
  const image = form.get('image')
  if (name.length < 2 || name.length > 60 || /[%_]/.test(name)) {
    return NextResponse.json({ error: 'اسم الماب يجب أن يكون بين حرفين و60 حرفاً' }, { status: 400 })
  }

  const { data: existing, error: lookupError } = await context.admin.from('marketplace_games').select('name')
  if (lookupError) return NextResponse.json({ error: 'تعذّر التحقق من اسم الماب' }, { status: 500 })
  if (existing?.some((map) => map.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return NextResponse.json({ error: 'هذا الماب مضاف بالفعل' }, { status: 409 })
  }

  let thumbnailUrl: string | null = null
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadThumbnail(image, context.userId).catch(() => null)
    if (!uploaded || 'error' in uploaded) return NextResponse.json({ error: uploaded?.error ?? 'تعذّر رفع صورة الماب' }, { status: 400 })
    thumbnailUrl = uploaded.url
  }

  const { data: map, error } = await context.admin.from('marketplace_games').insert({
    name,
    thumbnail_url: thumbnailUrl,
    created_by: context.userId,
  }).select('id, name, emoji, thumbnail_url, active, created_at').single()
  if (error) {
    if (thumbnailUrl) await del(thumbnailUrl).catch(() => undefined)
    return NextResponse.json({ error: 'تعذّرت إضافة الماب' }, { status: 500 })
  }
  return NextResponse.json({ map }, { status: 201 })
}

export async function PATCH(request: Request) {
  const context = await requireAdmin()
  if (!context.ok) return authError(context.error)

  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null)
    const id = String(form?.get('id') ?? '')
    const image = form?.get('image') ?? null
    if (!id || !(image instanceof File)) return NextResponse.json({ error: 'اختر صورة صالحة للماب' }, { status: 400 })
    const uploaded = await uploadThumbnail(image, context.userId).catch(() => null)
    if (!uploaded || 'error' in uploaded) return NextResponse.json({ error: uploaded?.error ?? 'تعذّر رفع صورة الماب' }, { status: 400 })
    const { data, error } = await context.admin.from('marketplace_games')
      .update({ thumbnail_url: uploaded.url, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error || !data) {
      await del(uploaded.url).catch(() => undefined)
      return NextResponse.json({ error: error ? 'تعذّر تحديث صورة الماب' : 'الماب غير موجود' }, { status: error ? 500 : 404 })
    }
    return NextResponse.json({ ok: true })
  }

  const body = await request.json().catch(() => null) as { id?: unknown; active?: unknown } | null
  if (typeof body?.id !== 'string' || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }
  const { data, error } = await context.admin.from('marketplace_games')
    .update({ active: body.active, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'تعذّر تحديث حالة الماب' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'الماب غير موجود' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
