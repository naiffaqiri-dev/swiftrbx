import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageCatalog, canSellCategory, CATALOG_CATEGORIES, sellerPermissions, validHttpsLinks, type CatalogCategory } from '@/lib/catalog'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

async function getCurrentProfile() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles')
    .select('id, username, display_name, avatar_url, role, seller_permissions, active')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !profile.active) return null
  return { user, profile, admin }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const sellerId = searchParams.get('sellerId')
  const mine = searchParams.get('mine') === '1'

  if (category && !CATALOG_CATEGORIES.includes(category as CatalogCategory)) {
    return errorResponse('القسم غير صالح', 400)
  }

  const admin = createAdminClient()
  let query = admin.from('marketplace_catalog_items')
    .select('id, seller_id, category, name, description, image_url, links, game, active, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (sellerId) query = query.eq('seller_id', sellerId)
  if (mine) {
    const current = await getCurrentProfile()
    if (!current || !canManageCatalog(current.profile.role, sellerPermissions(current.profile.seller_permissions))) {
      return errorResponse('غير مصرّح', 403)
    }
    query = admin.from('marketplace_catalog_items')
      .select('id, seller_id, category, name, description, image_url, links, game, active, created_at')
      .eq('seller_id', current.user.id)
      .order('created_at', { ascending: false })
    if (category) query = query.eq('category', category)
  }

  const { data: items, error } = await query
  if (error) return errorResponse('تعذّر تحميل المنتجات', 500)
  const sellerIds = [...new Set((items ?? []).map((item) => item.seller_id))]
  const { data: sellers } = sellerIds.length
    ? await admin.from('profiles').select('id, username, display_name, avatar_url, active').in('id', sellerIds).eq('active', true)
    : { data: [] }
  const sellerById = new Map((sellers ?? []).map((seller) => [seller.id, seller]))
  return NextResponse.json({
    items: (items ?? [])
      .filter((item) => sellerById.has(item.seller_id))
      .map((item) => ({ ...item, seller: sellerById.get(item.seller_id)! })),
  })
}

export async function POST(request: Request) {
  const current = await getCurrentProfile()
  if (!current || !canManageCatalog(current.profile.role, sellerPermissions(current.profile.seller_permissions))) {
    return errorResponse('غير مصرّح', 403)
  }

  const form = await request.formData().catch(() => null)
  if (!form) return errorResponse('نموذج غير صالح', 400)
  const category = String(form.get('category') ?? '')
  if (!CATALOG_CATEGORIES.includes(category as CatalogCategory) || !canSellCategory(current.profile.role, sellerPermissions(current.profile.seller_permissions), category as CatalogCategory)) {
    return errorResponse('لا تملك صلاحية البيع في هذا القسم', 403)
  }

  const name = String(form.get('name') ?? '').trim()
  const description = String(form.get('description') ?? '').trim()
  const game = String(form.get('game') ?? '').trim() || 'أغراض عامة'
  const image = form.get('image')
  let links: unknown
  try {
    links = JSON.parse(String(form.get('links') ?? '[]'))
  } catch {
    return errorResponse('تحقق من صيغة الروابط', 400)
  }

  if (name.length < 2 || name.length > 100) return errorResponse('اسم المنتج يجب أن يكون بين حرفين و100 حرف', 400)
  if (description.length > 2000) return errorResponse('الوصف أطول من الحد المسموح', 400)
  if (game.length < 2 || game.length > 40) return errorResponse('اسم اللعبة يجب أن يكون بين حرفين و40 حرفاً', 400)
  if (!validHttpsLinks(links)) return errorResponse('أدخل حتى 5 روابط HTTPS صحيحة', 400)
  if (!(image instanceof File) || image.size < 1 || image.size > MAX_IMAGE_BYTES || !MIME_EXTENSIONS[image.type]) {
    return errorResponse('أرفق صورة PNG أو JPEG أو WebP أو AVIF بحجم أقصى 8 ميغابايت', 400)
  }

  const filePath = `${current.user.id}/${randomUUID()}.${MIME_EXTENSIONS[image.type]}`
  const admin = current.admin
  const { error: uploadError } = await admin.storage.from('marketplace-listings').upload(filePath, image, {
    contentType: image.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) return errorResponse('تعذّر رفع الصورة، حاول مرة أخرى', 500)
  const { data: imageData } = admin.storage.from('marketplace-listings').getPublicUrl(filePath)
  const { data: item, error } = await admin.from('marketplace_catalog_items').insert({
    seller_id: current.user.id,
    category,
    name,
    description: description || null,
    image_url: imageData.publicUrl,
    links: links as string[],
    game,
  }).select('id').single()

  if (error) {
    await admin.storage.from('marketplace-listings').remove([filePath])
    return errorResponse('تعذّر نشر المنتج', 500)
  }
  return NextResponse.json({ id: item.id }, { status: 201 })
}

export async function PATCH(request: Request) {
  const current = await getCurrentProfile()
  if (!current || !canManageCatalog(current.profile.role, sellerPermissions(current.profile.seller_permissions))) {
    return errorResponse('غير مصرّح', 403)
  }

  const body = await request.json().catch(() => null) as { id?: string; active?: boolean } | null
  if (!body?.id || typeof body.active !== 'boolean') return errorResponse('طلب غير صالح', 400)
  const { error } = await current.admin.from('marketplace_catalog_items')
    .update({ active: body.active })
    .eq('id', body.id)
    .eq('seller_id', current.user.id)
  if (error) return errorResponse('تعذّر تحديث المنتج', 500)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const current = await getCurrentProfile()
  if (!current || !canManageCatalog(current.profile.role, sellerPermissions(current.profile.seller_permissions))) {
    return errorResponse('غير مصرّح', 403)
  }
  const body = await request.json().catch(() => null) as { id?: string } | null
  if (!body?.id) return errorResponse('طلب غير صالح', 400)
  const { error } = await current.admin.from('marketplace_catalog_items')
    .delete()
    .eq('id', body.id)
    .eq('seller_id', current.user.id)
  if (error) return errorResponse('تعذّر حذف المنتج', 500)
  return NextResponse.json({ ok: true })
}
