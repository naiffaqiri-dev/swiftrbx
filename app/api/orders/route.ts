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

  // Coupon (server-side).
  let discount = 0
  const coupons: Record<string, { type: "percent" | "flat"; value: number }> = {
    SWIFT10: { type: "percent", value: 10 },
    WELCOME5: { type: "flat", value: 5 },
  }
  if (couponCode && coupons[String(couponCode).toUpperCase()]) {
    const c = coupons[String(couponCode).toUpperCase()]
    discount = c.type === "percent" ? +(price * (c.value / 100)).toFixed(2) : Math.min(c.value, price)
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
      coupon_code: couponCode,
      payment_method: paidFully ? "balance" : paymentMethod,
      bank_key: paidFully ? null : bankKey,
      receipt_url: receiptUrl,
      sender_name: senderName,
      status,
    })
    .select()
    .single()

  if (error || !order) return NextResponse.json({ error: "تعذّر إنشاء الطلب" }, { status: 500 })

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
      subject: `طلب ${requested.toLocaleString()} روبوكس`,
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
      body: `تم إنشاء الطلب: ${requested.toLocaleString()} R$ إلى حساب روبلوكس "${robloxUsername.trim()}".`,
    })
  }

  await notifyDiscord("orders", {
    title: paidFully ? "طلب جديد (مدفوع بالرصيد)" : "طلب جديد بانتظار تأكيد التحويل",
    fields: [
      { name: "الكمية", value: `${requested.toLocaleString()} R$`, inline: true },
      { name: "المبلغ", value: `${afterCoupon} SAR`, inline: true },
      { name: "حساب روبلوكس", value: robloxUsername.trim(), inline: true },
      { name: "الحالة", value: status, inline: true },
    ],
  })

  return NextResponse.json({ orderId: order.id, ticketId: ticket?.id ?? null, status, toPay })
}
