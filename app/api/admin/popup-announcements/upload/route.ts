import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requirePopupAnnouncementOwner } from '@/lib/popup-announcement-auth'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = new Map([
  ['image/jpeg', { extension: 'jpg', valid: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ['image/png', { extension: 'png', valid: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 }],
  ['image/webp', { extension: 'webp', valid: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' }],
  ['image/gif', { extension: 'gif', valid: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === 'GIF8' }],
])

export async function POST(request: Request) {
  const owner = await requirePopupAnnouncementOwner()
  if ('response' in owner) return owner.response

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'حجم الصورة غير صالح (الحد الأقصى 5 ميغابايت)' }, { status: 400 })
  }

  const imageType = IMAGE_TYPES.get(file.type)
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!imageType || !imageType.valid(bytes)) {
    return NextResponse.json({ error: 'ارفع صورة JPG أو PNG أو WebP أو GIF صالحة' }, { status: 400 })
  }

  try {
    const blob = await put(`popup-announcements/${crypto.randomUUID()}.${imageType.extension}`, file, {
      access: 'private',
      contentType: file.type,
    })
    const imageUrl = `/api/popup-announcements/image?pathname=${encodeURIComponent(blob.pathname)}`
    return NextResponse.json({ imageUrl }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'تعذّر رفع الصورة' }, { status: 500 })
  }
}
