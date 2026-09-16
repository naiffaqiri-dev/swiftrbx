import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyDiscord } from "@/lib/discord"

const THIRTY_MIN = 30 * 60 * 1000

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 })

  const { orderId, action, rating, comment } = body as {
    orderId: string
    action: "deliver" | "confirm" | "auto_complete" | "dispute"
    rating?: number
    comment?: string
  }
  if (!orderId || !["deliver", "confirm", "auto_complete", "dispute"].includes(action))
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 })

  const admin = createAdminClient()
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single()
  if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })

  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single()
  const isAdmin = !!me && ["owner", "admin"].includes(me.role)
  const isSeller = order.seller_id === user.id
  const isBuyer = order.buyer_id === user.id
  const now = new Date().toISOString()

  // البائع: تأكيد التسليم + إضافة الرصيد القابل للسحب فوراً
  if (action === "deliver") {
    if (!isSeller && !isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    if (order.status !== "processing")
      return NextResponse.json({ error: "لا يمكن تسليم هذا الطلب في حالته الحالية" }, { status: 409 })

    await admin.from("orders").update({ status: "delivered", delivered_at: now, updated_at: now }).eq("id", orderId)
    await admin.from("tickets").update({ status: "delivered", updated_at: now }).eq("order_id", orderId)

    if (!order.seller_credited && order.seller_id) {
      const { data: sp } = await admin.from("profiles").select("balance").eq("id", order.seller_id).single()
      const newBalance = +(Number(sp?.balance ?? 0) + Number(order.price_sar)).toFixed(2)
      await admin.from("profiles").update({ balance: newBalance }).eq("id", order.seller_id)
      await admin.from("orders").update({ seller_credited: true }).eq("id", orderId)
    }

    await notifyDiscord("orders", {
      title: "تم تأكيد تسليم الطلب",
      fields: [
        { name: "الكمية", value: `${Number(order.robux_amount).toLocaleString()} R$`, inline: true },
        { name: "حساب روبلوكس", value: order.roblox_username, inline: true },
      ],
    })
    return NextResponse.json({ ok: true })
  }

  // المشتري: تأكيد الاستلام + التقييم — أو الإكمال التلقائي بعد 30 دقيقة
  if (action === "confirm" || action === "auto_complete") {
    if (action === "confirm" && !isBuyer && !isAdmin)
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    if (order.status !== "delivered") return NextResponse.json({ ok: false, skipped: true })

    if (action === "auto_complete") {
      const delivered = order.delivered_at ? Date.parse(order.delivered_at) : 0
      if (!delivered || Date.now() - delivered < THIRTY_MIN)
        return NextResponse.json({ ok: false, skipped: true })
    }

    await admin.from("orders").update({ status: "completed", completed_at: now, updated_at: now }).eq("id", orderId)
    await admin.from("tickets").update({ status: "completed", updated_at: now }).eq("order_id", orderId)

    if (order.seller_id) {
      const { data: sp } = await admin.from("profiles").select("sales").eq("id", order.seller_id).single()
      await admin.from("profiles").update({ sales: Number(sp?.sales ?? 0) + 1 }).eq("id", order.seller_id)
    }

    // تقييم متبادل: المشتري يقيّم البائع
    if (action === "confirm" && rating && order.seller_id) {
      const stars = Math.max(1, Math.min(5, Math.round(Number(rating))))
      await admin.from("reviews").upsert(
        {
          order_id: orderId,
          reviewer_id: order.buyer_id,
          reviewee_id: order.seller_id,
          direction: "buyer_to_seller",
          rating: stars,
          comment: (comment ?? "").toString().slice(0, 500),
        },
        { onConflict: "order_id,reviewer_id" },
      )
      const { data: sp } = await admin.from("profiles").select("rating, rating_count").eq("id", order.seller_id).single()
      const cnt = Number(sp?.rating_count ?? 0)
      const avg = Number(sp?.rating ?? 0)
      const newCnt = cnt + 1
      const newAvg = +(((avg * cnt) + stars) / newCnt).toFixed(2)
      await admin.from("profiles").update({ rating: newAvg, rating_count: newCnt }).eq("id", order.seller_id)
    }
    return NextResponse.json({ ok: true })
  }

  // المشتري: فتح نزاع
  if (action === "dispute") {
    if (!isBuyer && !isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    await admin.from("orders").update({ status: "disputed", updated_at: now }).eq("id", orderId)
    await admin.from("tickets").update({ type: "dispute", status: "disputed", updated_at: now }).eq("order_id", orderId)
    await notifyDiscord("support", {
      title: "نزاع جديد على طلب",
      fields: [
        { name: "الطلب", value: orderId.slice(0, 8), inline: true },
        { name: "حساب روبلوكس", value: order.roblox_username, inline: true },
      ],
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 })
}
