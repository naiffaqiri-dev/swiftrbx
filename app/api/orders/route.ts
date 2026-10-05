import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBank } from "@/lib/banks"
import { notifyDiscord } from "@/lib/discord"

const DELIVERY = ["group", "gamepass", "gift", "plus"]

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 })

  const {
    offerId,
    robloxUsername,
    delivery,
    useBalance = false,
    couponCode = null,
    receiptUrl = null,
    senderName = null,
    bankKey = null,
    paymentMethod = "bank_transfer",
  } = body

  if (!offerId || typeof offerId !== "string")
    return NextResponse.json({ error: "لم يتم اختيار عرض" }, { status: 400 })
  if (!robloxUsername || typeof robloxUsername !== "string" || !robloxUsername.trim())
    return NextResponse.json({ error: "اسم المستخدم في روبلوكس مطلوب" }, { status: 400 })
  if (!DELIVERY.includes(delivery))
    return NextResponse.json({ error: "طريقة تسليم غير صالحة" }, { status: 400 })

  const admin = createAdminClient()

  // Server-side offer validation & price recompute.
  const { data: offer } = await admin.from("offers").select("*").eq("id", offerId).eq("active", true).single()
  if (!offer) return NextResponse.json({ error: "العرض لم يعد متاحاً" }, { status: 409 })

  const requested = Number(body.amount ?? 0)
  if (!Number.isInteger(requested) || requested <= 0)
    return NextResponse.json({ error: "الكمية غير صالحة" }, { status: 400 })
  if (requested < Number(offer.min_amount) || requested > Number(offer.max_amount))
    return NextResponse.json({ error: "الكمية خارج حدود العرض" }, { status: 400 })
  if (requested > Number(offer.available))
    return NextResponse.json({ error: "الكمية المطلوبة أكبر من المتاح" }, { status: 409 })
  if (!Array.isArray(offer.delivery) || !offer.delivery.includes(delivery))
    return NextResponse.json({ error: "طريقة التسليم غير مدعومة لهذا العرض" }, { status: 400 })

  const price = +((requested / 1000) * Number(offer.rate)).toFixed(2)

  const normalizedCouponCode = typeof couponCode === "string" ? couponCode.trim().toUpperCase() : null
  if (couponCode !== null && couponCode !== undefined &&
      (typeof couponCode !== "string" || !/^[A-Z0-9_-]{3,32}$/i.test(couponCode.trim()))) {
    return NextResponse.json({ error: "رمز الكوبون غير صالح" }, { status: 400 })
  }

  let discount = 0
  if (normalizedCouponCode) {
    const { data: couponLimits } = await admin.from("coupons")
      .select("min_robux, max_robux")
      .eq("code", normalizedCouponCode)
      .eq("active", true)
      .maybeSingle()
    if (couponLimits && ((couponLimits.min_robux !== null && requested < couponLimits.min_robux) ||
        (couponLimits.max_robux !== null && requested > couponLimits.max_robux))) {
      return NextResponse.json({ error: "كمية الروبكس خارج النطاق المسموح لهذا الكوبون" }, { status: 409 })
    }

    const { data, error: couponError } = await admin.rpc("redeem_coupon", {
      p_code: normalizedCouponCode,
      p_user_id: user.id,
      p_subtotal: price,
    })
    if (couponError) {
      const reason = couponError.message ?? ""
      const message = reason.includes("COUPON_LIMIT_REACHED")
        ? "انتهت مرات استخدام هذا الكوبون"
        : reason.includes("COUPON_USER_LIMIT_REACHED")
          ? "استنفدت مرات استخدامك لهذا الكوبون"
          : reason.includes("COUPON_NOT_ELIGIBLE")
            ? "هذا الكوبون غير متاح لحسابك أو لهذه القيمة"
            : "الكوبون غير صالح أو غير متاح"
      return NextResponse.json({ error: message }, { status: 409 })
    }
    discount = Number(data)
    if (!Number.isFinite(discount) || discount < 0 || discount > price) {
      return NextResponse.json({ error: "تعذّر التحقق من قيمة الكوبون" }, { status: 409 })
    }
  }
  const afterCoupon = Math.max(0, +(price - discount).toFixed(2))

  // Balance handling.
  const { data: profile } = await admin.from("profiles").select("balance").eq("id", user.id).single()
  const balance = Number(profile?.balance ?? 0)
  const balanceUsed = useBalance ? Math.min(balance, afterCoupon) : 0
  const toPay = +(afterCoupon - balanceUsed).toFixed(2)

  const paidFully = toPay <= 0
  if (!paidFully) {
    if (paymentMethod === "bank_transfer" && !getBank(bankKey))
      return NextResponse.json({ error: "بيانات البنك غير صالحة" }, { status: 400 })
  }

  const status = paidFully ? "processing" : "confirming"

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id: offer.seller_id,
      offer_id: offer.id,
      robux_amount: requested,
      roblox_username: robloxUsername.trim(),
      delivery_method: delivery,
      price_sar: afterCoupon,
      coupon_code: normalizedCouponCode,
      payment_method: paidFully ? "balance" : paymentMethod,
      bank_key: paidFully ? null : bankKey,
      receipt_url: receiptUrl,
      sender_name: senderName,
      status,
    })
    .select()
    .single()

  if (error || !order) return NextResponse.json({ error: "تعذّر إنشاء الطلب" }, { status: 500 })

  if (normalizedCouponCode) {
    const { error: redemptionError } = await admin.rpc("redeem_coupon", {
      p_code: normalizedCouponCode,
      p_user_id: user.id,
      p_subtotal: price,
      p_order_id: order.id,
      p_expected_discount: discount,
    })
    if (redemptionError) {
      await admin.from("orders").delete().eq("id", order.id).eq("buyer_id", user.id)
      const reason = redemptionError.message ?? ""
      const message = reason.includes("COUPON_LIMIT_REACHED")
        ? "انتهت مرات استخدام هذا الكوبون قبل إتمام الطلب"
        : reason.includes("COUPON_USER_LIMIT_REACHED")
          ? "استنفدت مرات استخدامك لهذا الكوبون"
          : reason.includes("COUPON_NOT_ELIGIBLE")
            ? "لم يعد هذا الكوبون متاحاً لحسابك أو لهذه القيمة"
            : "تغيرت صلاحية الكوبون؛ أعد التحقق منه ثم حاول مجدداً"
      return NextResponse.json({ error: message }, { status: 409 })
    }
  }

  // Deduct balance immediately if used.
  if (balanceUsed > 0) {
    await admin
      .from("profiles")
      .update({ balance: +(balance - balanceUsed).toFixed(2) })
      .eq("id", user.id)
  }

  // Open a delivery ticket between buyer and seller.
  const { data: ticket } = await admin
    .from("tickets")
    .insert({
      type: "order",
      subject: `طلب ${requested.toLocaleString('en-US')} روبوكس`,
      order_id: order.id,
      buyer_id: user.id,
      seller_id: offer.seller_id,
      status: paidFully ? "open" : "pending_payment",
    })
    .select()
    .single()

  if (ticket) {
    await admin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      body: `تم إنشاء الطلب: ${requested.toLocaleString('en-US')} R$ إلى حساب روبلوكس "${robloxUsername.trim()}".`,
    })
  }

  await notifyDiscord("orders", {
    title: paidFully ? "طلب جديد (مدفوع بالرصيد)" : "طلب جديد بانتظار تأكيد التحويل",
    fields: [
      { name: "الكمية", value: `${requested.toLocaleString('en-US')} R$`, inline: true },
      { name: "المبلغ", value: `${afterCoupon} SAR`, inline: true },
      { name: "حساب روبلوكس", value: robloxUsername.trim(), inline: true },
      { name: "الحالة", value: status, inline: true },
    ],
  })

  return NextResponse.json({ orderId: order.id, ticketId: ticket?.id ?? null, status, toPay })
}
