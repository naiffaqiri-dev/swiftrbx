import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const MAX_AVATAR_SIZE = 3 * 1024 * 1024
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
} as const

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const requestHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origin && requestHost && new URL(origin).host !== requestHost) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'ملف الصورة غير صالح' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'يرجى اختيار صورة' }, { status: 400 })
  }

  const extension = Object.entries(IMAGE_TYPES).find(([type]) => type === file.type)?.[1]
  if (!extension) {
    return NextResponse.json({ error: 'الصيغ المدعومة: JPG وPNG وWebP وAVIF' }, { status: 415 })
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: 'حجم الصورة يجب ألا يتجاوز 3 ميجابايت' }, { status: 413 })
  }

  const admin = createAdminClient()
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await admin.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })

  if (uploadError) {
    return NextResponse.json({ error: 'تعذّر رفع الصورة حالياً، حاول مرة أخرى' }, { status: 502 })
  }

  const { data } = admin.storage.from('avatars').getPublicUrl(path)
  const { error: profileError } = await admin
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', user.id)

  if (profileError) {
    await admin.storage.from('avatars').remove([path])
    return NextResponse.json({ error: 'تعذّر حفظ الصورة الشخصية' }, { status: 500 })
  }

  return NextResponse.json({ avatarUrl: data.publicUrl })
}

export async function DELETE(request: Request) {
  const origin = request.headers.get('origin')
  const requestHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origin && requestHost && new URL(origin).host !== requestHost) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: 'تعذّر حفظ التغييرات' }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json({ error: 'تعذّر العثور على الملف الشخصي' }, { status: 404 })
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'تعذّر حفظ التغييرات' }, { status: 500 })
  }

  if (profile.avatar_url) {
    try {
      const bucket = admin.storage.from('avatars')
      const publicBase = new URL(bucket.getPublicUrl('').data.publicUrl)
      const avatarUrl = new URL(profile.avatar_url)
      const pathPrefix = publicBase.pathname.endsWith('/')
        ? publicBase.pathname
        : `${publicBase.pathname}/`

      if (avatarUrl.origin === publicBase.origin && avatarUrl.pathname.startsWith(pathPrefix)) {
        const objectPath = decodeURIComponent(avatarUrl.pathname.slice(pathPrefix.length))
        const pathParts = objectPath.split('/')
        const isOwnedAvatar = objectPath.startsWith(`${user.id}/`) &&
          pathParts.every((part) => part.length > 0 && part !== '.' && part !== '..')

        if (isOwnedAvatar) {
          const { error: removeError } = await bucket.remove([objectPath])
          if (removeError) console.error('[v0] Could not remove profile avatar object', removeError.name)
        }
      }
    } catch (removeError) {
      console.error(
        '[v0] Could not parse or remove profile avatar object',
        removeError instanceof Error ? removeError.name : 'unknown_error',
      )
    }
  }

  return NextResponse.json({ avatarUrl: null })
}
