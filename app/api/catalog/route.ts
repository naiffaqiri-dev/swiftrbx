import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const CATEGORIES = ['limited', 'account', 'map_item'] as const
const CATEGORY_PERMISSIONS = {
  limited: 'catalog_limited',
  account: 'catalog_account',
  map_item: 'catalog_map_item',
} as const
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

function validLinks(value: FormDataEntryValue | null) {
  const links = String(value ?? '')
    .split(/\r?\n/)
    .map((link) => link.trim())
    .filter(Boolean)
  if (links.length > 8) return null
  for (const link of links) {
    try {
      const parsed = new URL(link)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null
    } catch {
      return null
    }
  }
  return [...new Set(links)]
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const category = url.searchParams.get('category')
  const sellerId = url.searchParams.get('seller')
  if (category && !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return NextResponse.json({ error: 'قسم غير صالح' }, { status: 400 })
  }

  const admin = createAdminClient()
  let query = admin
    .from('marketplace_catalog_items')
    .select('id,seller_id,category,name,description,image_url,links,game,created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (category) query = query.eq('category', category)
  if (sellerId) query = query.eq('seller_id', sellerId)

  const { data: items, error } = await query.limit(300)
  if (error) return NextResponse.json({ error: 'تعذّر تحميل المنتجات' }, { status: 500 })

  const sellerIds = [...new Set((items ?? []).map((item) => item.seller_id))]
  const { data: profiles } = sellerIds.length
    ? await admin.from('profiles').select('id,username,display_name,avatar_url,rating,sales').in('id', sellerIds)
    : { data: [] }
  const sellers = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  return NextResponse.json({
    items: (items ?? []).map((item) => ({
      ...item,
      seller: sellers.get(item.seller_id) ?? { id: item.seller_id, username: 'بائع SwiftRBX' },
    })),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'الطلب غير صالح' }, { status: 400 })
  }

  const category = String(form.get('category') ?? '') as keyof typeof CATEGORY_PERMISSIONS
  const name = String(form.get('name') ?? '').trim()
  const description = String(form.get('description') ?? '').trim()
  const game = String(form.get('game') ?? 'أغراض عامة').trim()
  const links = validLinks(form.get('links'))
  const image = form.get('image')

  if (!Object.hasOwn(CATEGORY_PERMISSIONS, category)) {
    return NextResponse.json({ error: 'القسم غير صالح' }, { status: 400 })
  }
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ error: 'اكتب اسماً بين حرفين و100 حرف' }, { status: 400 })
  }
  if (description.length > 2000 || game.length < 2 || game.length > 40) {
    return NextResponse.json({ error: 'تحقق من الوصف واسم اللعبة' }, { status: 400 })
  }
  if (!links) return NextResponse.json({ error: 'أدخل روابط HTTPS صحيحة (حتى 8 روابط)' }, { status: 400 })
  if (!(image instanceof File) || image.size === 0 || image.size > 8 * 1024 * 1024 || !MIME_EXTENSIONS[image.type]) {
    return NextResponse.json({ error: 'أرفق صورة JPG أو PNG أو WebP أو AVIF لا تتجاوز 8 ميغابايت' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,role,active,seller_permissions')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || !profile || !profile.active) {
    return NextResponse.json({ error: 'الحساب غير نشط' }, { status: 403 })
  }
  const permissions = Array.isArray(profile.seller_permissions) ? profile.seller_permissions : []
  if (profile.role !== 'seller' && !permissions.includes(CATEGORY_PERMISSIONS[category])) {
    return NextResponse.json({ error: 'ليست لديك صلاحية النشر في هذا القسم' }, { status: 403 })
  }
  if (profile.role === 'seller' && !permissions.includes(CATEGORY_PERMISSIONS[category])) {
    return NextResponse.json({ error: 'اطلب من الإدارة إضافة صلاحية هذا القسم لحسابك' }, { status: 403 })
  }

  const objectPath = `${user.id}/${randomUUID()}.${MIME_EXTENSIONS[image.type]}`
  const { error: uploadError } = await admin.storage
    .from('marketplace-listings')
    .upload(objectPath, image, { contentType: image.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: 'تعذّر رفع الصورة، حاول مرة أخرى' }, { status: 500 })

  const { data: publicImage } = admin.storage.from('marketplace-listings').getPublicUrl(objectPath)
  const { data: item, error: insertError } = await admin
    .from('marketplace_catalog_items')
    .insert({
      seller_id: user.id,
      category,
      name,
      description: description || null,
      image_url: publicImage.publicUrl,
      links,
      game,
    })
    .select('id')
    .single()

  if (insertError) {
    await admin.storage.from('marketplace-listings').remove([objectPath])
    return NextResponse.json({ error: 'تعذّر نشر المنتج، حاول مرة أخرى' }, { status: 500 })
  }
  return NextResponse.json({ id: item.id }, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'معرّف المنتج مطلوب' }, { status: 400 })

  const admin = createAdminClient()
  const { data: item } = await admin
    .from('marketplace_catalog_items')
    .select('id,seller_id,image_url')
    .eq('id', id)
    .maybeSingle()
  if (!item || item.seller_id !== user.id) return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  const { error } = await admin.from('marketplace_catalog_items').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: 'تعذّر إخفاء المنتج' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
