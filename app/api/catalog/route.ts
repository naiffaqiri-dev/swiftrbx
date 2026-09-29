import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageCatalog, canSellCategory, CATALOG_CATEGORIES, isValidCatalogPrice, sellerPermissions, validHttpsLinks, type CatalogCategory } from '@/lib/catalog'

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
    .select('id, seller_id, category, name, description, image_url, links, game, active, created_at, price_sar, map_category, game_emoji, map_category_emoji, map_thumbnail_url, map_url')
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
      .select('id, seller_id, category, name, description, image_url, links, game, active, created_at, price_sar, map_category, game_emoji, map_category_emoji, map_thumbnail_url, map_url')
      .eq('seller_id', current.user.id)
      .order('created_at', { ascending: false })
    if (category) query = query.eq('category', category)
  }

  const { data: items, error } = await query
  if (error) return errorResponse('تعذّر تحميل المنتجات', 500)
  const sellerIds = [...new Set((items ?? []).map((item) => item.seller_id))]
  const { data: sellers } = sellerIds.length
    ? await admin.from('profiles').select('id, username, display_name, avatar_url, active, rating, rating_count').in('id', sellerIds).eq('active', true)
    : { data: [] }
  const sellerById = new Map((sellers ?? []).map((seller) => [seller.id, seller]))
  const { data: games } = category === 'map_item'
    ? await admin.from('marketplace_games').select('name, thumbnail_url')
    : { data: [] }
  const thumbnailByGameName = new Map((games ?? []).map((game) => [game.name, game.thumbnail_url]))
  return NextResponse.json({
    items: (items ?? [])
      .filter((item) => sellerById.has(item.seller_id))
      .map((item) => {
        const seller = sellerById.get(item.seller_id)!
        return {
          ...item,
          map_thumbnail_url: thumbnailByGameName.get(item.game) || item.map_thumbnail_url || null,
          seller: { ...seller, rating: Number(seller.rating ?? 0), rating_count: Number(seller.rating_count ?? 0) },
        }
      }),
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
  const selectedGameId = String(form.get('gameId') ?? '').trim()
  let game = 'أغراض عامة'
  let gameEmoji: string | null = null
  let selectedGame: { name: string; emoji: string | null; thumbnail_url: string | null } | null = null
  const mapCategory = String(form.get('mapCategory') ?? '').trim()
  const mapCategoryEmoji = String(form.get('mapCategoryEmoji') ?? '').trim()
  const mapThumbnailUrl = String(form.get('mapThumbnailUrl') ?? '').trim()
  const mapUrl = String(form.get('mapUrl') ?? '').trim()
  const priceSar = Number(form.get('priceSar'))
  const image = form.get('image')
  let links: unknown
  try {
    links = JSON.parse(String(form.get('links') ?? '[]'))
  } catch {
    return errorResponse('تحقق من صيغة الروابط', 400)
  }

  if (name.length < 2 || name.length > 100) return errorResponse('اسم المنتج يجب أن يكون بين حرفين و100 حرف', 400)
  if (description.length > 2000) return errorResponse('الوصف أطول من الحد المسموح', 400)
  if (category === 'map_item') {
    if (!selectedGameId) return errorResponse('اختر ماباً معتمداً من الإدارة', 400)
    const { data, error: gameError } = await current.admin.from('marketplace_games')
      .select('id, name, emoji, thumbnail_url')
      .eq('id', selectedGameId)
      .eq('active', true)
      .maybeSingle()
    if (gameError) return errorResponse('تعذّر التحقق من الماب المعتمد', 500)
    if (!data) return errorResponse('هذا الماب غير معتمد أو تم إيقافه. اختر ماباً متاحاً من القائمة.', 400)
    selectedGame = data
    game = selectedGame.name
    gameEmoji = selectedGame.emoji
  }
  if (category === 'map_item' && (mapCategory.length < 2 || mapCategory.length > 60)) return errorResponse('أدخل اسم فئة الماب (2–60 حرفاً)', 400)
  if (mapCategoryEmoji.length > 16) return errorResponse('إيموجي الفئة أطول من الحد المسموح', 400)
  if (mapThumbnailUrl && !validHttpsLinks([mapThumbnailUrl])) return errorResponse('رابط الصورة المصغرة يجب أن يكون HTTPS صحيحاً', 400)
  if (mapUrl && !validHttpsLinks([mapUrl])) return errorResponse('رابط الماب يجب أن يكون HTTPS صحيحاً', 400)
  if (!isValidCatalogPrice(priceSar)) return errorResponse('أدخل سعراً صحيحاً بالريال السعودي', 400)
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
    price_sar: priceSar,
    map_category: category === 'map_item' ? mapCategory : null,
    game_emoji: category === 'map_item' ? gameEmoji || null : null,
    map_category_emoji: category === 'map_item' ? mapCategoryEmoji || null : null,
    map_thumbnail_url: category === 'map_item' ? selectedGame?.thumbnail_url || mapThumbnailUrl || null : null,
    map_url: category === 'map_item' ? mapUrl || null : null,
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

  const body = await request.json().catch(() => null) as { id?: string; active?: boolean; priceSar?: number } | null
  if (!body?.id || (typeof body.active !== 'boolean' && body.priceSar === undefined)) return errorResponse('طلب غير صالح', 400)
  const updates: { active?: boolean; price_sar?: number } = {}
  if (typeof body.active === 'boolean') updates.active = body.active
  if (body.priceSar !== undefined) {
    if (!isValidCatalogPrice(body.priceSar)) {
      return errorResponse('أدخل سعراً صحيحاً بالريال السعودي', 400)
    }
    updates.price_sar = body.priceSar
  }
  const { error } = await current.admin.from('marketplace_catalog_items')
    .update(updates)
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
