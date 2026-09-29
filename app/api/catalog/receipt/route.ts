import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Map([
  ['image/jpeg', { extension: 'jpg', signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ['image/png', { extension: 'png', signature: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 }],
  ['image/webp', { extension: 'webp', signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' }],
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('receipt')
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ error: 'حجم الإيصال غير صالح (الحد الأقصى 5 ميغابايت)' }, { status: 400 })
  }

  const type = ALLOWED_TYPES.get(file.type)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!type || !type.signature(bytes)) {
    return NextResponse.json({ error: 'ارفع صورة إيصال بصيغة JPG أو PNG أو WEBP' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('active').eq('id', user.id).maybeSingle()
  if (!profile?.active) return NextResponse.json({ error: 'الحساب غير نشط' }, { status: 403 })

  const path = `${user.id}/marketplace-${crypto.randomUUID()}.${type.extension}`
  const { error } = await admin.storage.from('marketplace-receipts').upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return NextResponse.json({ error: 'تعذّر رفع الإيصال، حاول مرة أخرى' }, { status: 500 })

  return NextResponse.json({ receiptPath: path }, { status: 201 })
}

export const runtime = 'nodejs'
