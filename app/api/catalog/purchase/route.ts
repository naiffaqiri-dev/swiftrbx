import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidCatalogPrice } from '@/lib/catalog'
import { getBank } from '@/lib/banks'

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
    useBalance?: boolean
    bankKey?: string | null
    receiptUrl?: string | null
    senderName?: string | null
  } | null
  if (!body) return errorResponse('طلب غير صالح', 400)

  const admin = createAdminClient()
  const { data: currentProfile } = await admin.from('profiles').select('role, active, balance').eq('id', user.id).maybeSingle()
  if (!currentProfile?.active) return errorResponse('الحساب غير نشط', 403)

  if (body.action === 'purchase') {
    if (!body.itemId) return errorResponse('المنتج غير صالح', 400)
    const { data: item } = await admin.from('marketplace_catalog_items')
      .select('id, seller_id, name, price_sar, active, game, game_emoji, map_category, map_category_emoji')
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
      .in('status', ['open', 'delivered', 'pending_payment'])
      .limit(1)
      .maybeSingle()
    if (existing) return NextResponse.json({ ticketId: existing.id, existing: true })

    const useBalance = body.useBalance !== false
    const walletAmount = useBalance ? Math.min(Number(currentProfile.balance ?? 0), price) : 0
    const remaining = +(price - walletAmount).toFixed(2)
    const paymentMethod = remaining > 0 ? 'bank_transfer' : 'balance'
    let bankKey: string | null = null
    let receiptUrl: string | null = null
    let senderName: string | null = null

    if (remaining > 0) {
      bankKey = typeof body.bankKey === 'string' ? body.bankKey : null
      receiptUrl = typeof body.receiptUrl === 'string' ? body.receiptUrl : null
      senderName = typeof body.senderName === 'string' ? body.senderName.trim().slice(0, 120) : null
      if (!getBank(bankKey) || !senderName || !receiptUrl) {
        return errorResponse('بيانات التحويل البنكي غير مكتملة', 400)
      }
      try {
        const proof = new URL(receiptUrl)
        const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '')
        if (
          proof.origin !== supabaseUrl.origin ||
          !proof.pathname.startsWith(`/storage/v1/object/public/receipts/${user.id}/marketplace-`)
        ) return errorResponse('رابط الإيصال غير صالح', 400)
      } catch {
        return errorResponse('رابط الإيصال غير صالح', 400)
      }
    }

    const itemContext = item.map_category
      ? ` (${item.game_emoji ? `${item.game_emoji} ` : ''}${item.game} · ${item.map_category_emoji ? `${item.map_category_emoji} ` : ''}${item.map_category})`
      : ''
    const { data: ticketId, error } = await admin.rpc('create_marketplace_purchase', {
      p_buyer_id: user.id,
      p_seller_id: item.seller_id,
      p_item_id: item.id,
      p_subject: `طلب شراء: ${item.name}${itemContext}`,
      p_purchase_price_sar: price,
      p_payment_method: paymentMethod,
      p_bank_key: bankKey,
      p_receipt_url: receiptUrl,
      p_sender_name: senderName,
      p_wallet_amount_sar: walletAmount,
      p_payment_verified_at: paymentMethod === 'balance' ? new Date().toISOString() : null,
    })
    if (error || !ticketId) {
      if (error?.message.includes('INSUFFICIENT_MARKETPLACE_BALANCE')) {
        return errorResponse('رصيد المحفظة تغيّر، حدّث الصفحة وحاول مرة أخرى', 409)
      }
      return errorResponse('تعذّر إنشاء طلب الشراء', 500)
    }
    return NextResponse.json({ ticketId }, { status: 201 })
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
