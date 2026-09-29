import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) {
    return NextResponse.json({ error: 'الإيصال غير متاح' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  }

  const { data: ticket } = await admin.from('tickets')
    .select('buyer_id, payment_receipt_url')
    .eq('id', ticketId)
    .eq('type', 'order')
    .not('catalog_item_id', 'is', null)
    .maybeSingle()
  const path = ticket?.payment_receipt_url
  const pathPattern = ticket
    ? new RegExp(`^${ticket.buyer_id}/marketplace-[a-z0-9-]+\\.(jpg|png|webp)$`, 'i')
    : null
  if (!ticket || !path || !pathPattern?.test(path)) {
    return NextResponse.json({ error: 'الإيصال غير متاح' }, { status: 404 })
  }

  const { data, error } = await admin.storage.from('marketplace-receipts').createSignedUrl(path, 300)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'تعذّر فتح الإيصال' }, { status: 500 })
  }
  return NextResponse.json({ signedUrl: data.signedUrl }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export const runtime = 'nodejs'
