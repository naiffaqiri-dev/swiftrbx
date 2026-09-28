import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' }
const MAX_SELLER_IDS = 50

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestedIds = [...new Set((searchParams.get('sellerIds') ?? '').split(',').map((id) => id.trim()).filter(Boolean))]

  if (requestedIds.length > MAX_SELLER_IDS) {
    return NextResponse.json({ error: 'عدد البائعين المطلوبين أكبر من الحد المسموح' }, { status: 400, headers: RESPONSE_HEADERS })
  }

  if (requestedIds.length === 0) {
    return NextResponse.json({ sellers: [] }, { headers: RESPONSE_HEADERS })
  }

  const admin = createAdminClient()
  const { data: offers, error: offersError } = await admin.rpc('active_offers')
  if (offersError) {
    return NextResponse.json({ error: 'تعذّر تحميل بيانات البائعين' }, { status: 500, headers: RESPONSE_HEADERS })
  }

  const offeredSellerIds = new Set(((offers ?? []) as { seller_id: string }[]).map((offer) => offer.seller_id))
  const sellerIds = requestedIds.filter((id) => offeredSellerIds.has(id))
  if (sellerIds.length === 0) {
    return NextResponse.json({ sellers: [] }, { headers: RESPONSE_HEADERS })
  }

  const { data: sellers, error } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url, sales')
    .in('id', sellerIds)
    .eq('active', true)

  if (error) {
    return NextResponse.json({ error: 'تعذّر تحميل بيانات البائعين' }, { status: 500, headers: RESPONSE_HEADERS })
  }

  return NextResponse.json({ sellers: sellers ?? [] }, { headers: RESPONSE_HEADERS })
}
