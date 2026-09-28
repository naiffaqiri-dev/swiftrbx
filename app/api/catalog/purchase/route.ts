import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidCatalogPrice } from '@/lib/catalog'

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export async function POST(request: Request) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return errorResponse('يجب تسجيل الدخول لإتمام الطلب', 401)

  const body = await request.json().catch(() => null) as {
    action?: string
    itemId?: string
    ticketId?: string
    rating?: number
    comment?: string
  } | null
  if (!body) return errorResponse('طلب غير صالح', 400)

  const admin = createAdminClient()
  const { data: currentProfile } = await admin.from('profiles').select('role, active').eq('id', user.id).maybeSingle()
  if (!currentProfile?.active) return errorResponse('الحساب غير نشط', 403)

  if (body.action === 'purchase') {
    if (!body.itemId) return errorResponse('المنتج غير صالح', 400)
    const { data: item } = await admin.from('marketplace_catalog_items')
      .select('id, seller_id, name, price_sar, active')
      .eq('id', body.itemId)
      .eq('active', true)
      .maybeSingle()
    if (!item) return errorResponse('هذا المنتج لم يعد متاحاً', 404)
    if (item.seller_id === user.id) return errorResponse('لا يمكنك طلب منتج من متجرك', 400)
    const price = Number(item.price_sar)
    if (!isValidCatalogPrice(price)) return errorResponse('لم يحدد البائع سعر هذا المنتج بعد', 409)

    const { data: seller } = await admin.from('profiles').select('active').eq('id', item.seller_id).maybeSingle()
    if (!seller?.active) return errorResponse('متجر البائع غير متاح حالياً', 409)

    const { data: existing } = await admin.from('tickets')
      .select('id')
      .eq('type', 'order')
      .eq('buyer_id', user.id)
      .eq('catalog_item_id', item.id)
      .in('status', ['open', 'delivered'])
      .limit(1)
      .maybeSingle()
    if (existing) return NextResponse.json({ ticketId: existing.id, existing: true })

    const { data: ticket, error } = await admin.from('tickets').insert({
      type: 'order',
      subject: `طلب شراء: ${item.name}`,
      catalog_item_id: item.id,
      purchase_price_sar: price,
      buyer_id: user.id,
      seller_id: item.seller_id,
      status: 'open',
    }).select('id').single()
    if (error || !ticket) return errorResponse('تعذّر إنشاء طلب الشراء', 500)

    await admin.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      body: `تم إرسال طلب شراء «${item.name}» بسعر ${price.toFixed(2)} ر.س. تواصل مع البائع هنا لإتمام التفاصيل.`,
    })
    return NextResponse.json({ ticketId: ticket.id }, { status: 201 })
  }

  if (body.action !== 'deliver' && body.action !== 'confirm') return errorResponse('الإجراء غير صالح', 400)
  if (!body.ticketId) return errorResponse('التذكرة غير صالحة', 400)

  const { data: ticket } = await admin.from('tickets')
    .select('id, type, buyer_id, seller_id, catalog_item_id, status')
    .eq('id', body.ticketId)
    .maybeSingle()
  if (!ticket || ticket.type !== 'order' || !ticket.catalog_item_id || !ticket.seller_id) return errorResponse('طلب الشراء غير موجود', 404)

  const isAdmin = ['owner', 'admin'].includes(currentProfile.role)
  const isSeller = ticket.seller_id === user.id
  const isBuyer = ticket.buyer_id === user.id
  const now = new Date().toISOString()

  if (body.action === 'deliver') {
    if (!isSeller && !isAdmin) return errorResponse('غير مصرّح', 403)
    if (ticket.status !== 'open') return errorResponse('لا يمكن تأكيد التسليم في الحالة الحالية', 409)
    const { data: updated, error } = await admin.from('tickets')
      .update({ status: 'delivered', updated_at: now })
      .eq('id', ticket.id)
      .eq('status', 'open')
      .select('id')
      .maybeSingle()
    if (error || !updated) return errorResponse('تعذّر تحديث الطلب', 409)
    await admin.from('ticket_messages').insert({ ticket_id: ticket.id, sender_id: user.id, body: 'أكد البائع تسليم المنتج. يرجى تأكيد الاستلام وتقييم التجربة.' })
    return NextResponse.json({ ok: true })
  }

  if (!isBuyer) return errorResponse('غير مصرّح', 403)
  if (ticket.status !== 'delivered') return errorResponse('يجب أن يؤكد البائع التسليم أولاً', 409)
  if (!Number.isInteger(body.rating) || Number(body.rating) < 1 || Number(body.rating) > 5) {
    return errorResponse('اختر تقييماً من نجمة إلى خمس نجوم', 400)
  }
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) : ''
  const { data: updated, error: updateError } = await admin.from('tickets')
    .update({ status: 'completed', updated_at: now })
    .eq('id', ticket.id)
    .eq('status', 'delivered')
    .select('id')
    .maybeSingle()
  if (updateError || !updated) return errorResponse('تعذّر إكمال الطلب، حدّث الصفحة وحاول مرة أخرى', 409)

  const { error: reviewError } = await admin.from('reviews').insert({
    catalog_ticket_id: ticket.id,
    reviewer_id: user.id,
    reviewee_id: ticket.seller_id,
    direction: 'buyer_to_seller',
    rating: body.rating,
    comment,
  })
  if (reviewError) {
    await admin.from('tickets').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', ticket.id).eq('status', 'completed')
    return errorResponse('تعذّر حفظ التقييم، حاول مرة أخرى', 500)
  }

  const { data: reviews } = await admin.from('reviews')
    .select('rating')
    .eq('reviewee_id', ticket.seller_id)
    .eq('direction', 'buyer_to_seller')
  const total = reviews ?? []
  const count = total.length
  const average = count ? +(total.reduce((sum, review) => sum + Number(review.rating), 0) / count).toFixed(2) : 0
  await admin.from('profiles').update({ rating: average, rating_count: count }).eq('id', ticket.seller_id)
  await admin.from('ticket_messages').insert({ ticket_id: ticket.id, sender_id: user.id, body: `أكد المشتري استلام المنتج وقيّم البائع بـ ${body.rating} من 5.` })
  return NextResponse.json({ ok: true })
}
