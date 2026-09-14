import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyDiscord } from "@/lib/discord"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "unauthorized" as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !["owner", "admin"].includes(profile.role)) return { error: "forbidden" as const }
  return { admin, userId: user.id }
}

export async function POST(req: Request) {
  const ctx = await requireAdmin()
  if ("error" in ctx)
    return NextResponse.json(
      { error: ctx.error },
      { status: ctx.error === "unauthorized" ? 401 : 403 },
    )
  const { admin } = ctx

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 })

  const { kind, id, action } = body as {
    kind: "order" | "topup"
    id: string
    action: "confirm" | "reject"
  }
  if (!id || !["order", "topup"].includes(kind) || !["confirm", "reject"].includes(action))
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 })

  if (kind === "topup") {
    const { data: topup } = await admin.from("top_ups").select("*").eq("id", id).single()
    if (!topup) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
    if (topup.status !== "confirming")
      return NextResponse.json({ error: "تمت معالجة الطلب مسبقاً" }, { status: 409 })

    if (action === "reject") {
      await admin.from("top_ups").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id)
      return NextResponse.json({ ok: true })
    }

    const { data: profile } = await admin.from("profiles").select("balance").eq("id", topup.user_id).single()
    const newBalance = +(Number(profile?.balance ?? 0) + Number(topup.amount_sar)).toFixed(2)
    await admin.from("profiles").update({ balance: newBalance }).eq("id", topup.user_id)
    await admin.from("top_ups").update({ status: "confirmed", updated_at: new Date().toISOString() }).eq("id", id)
    await notifyDiscord("orders", {
      title: "تم تأكيد شحن رصيد",
      fields: [{ name: "المبلغ", value: `${topup.amount_sar} SAR`, inline: true }],
    })
    return NextResponse.json({ ok: true, newBalance })
  }

  // order
  const { data: order } = await admin.from("orders").select("*").eq("id", id).single()
  if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
  if (!["confirming", "pending_payment"].includes(order.status))
    return NextResponse.json({ error: "تمت معالجة الطلب مسبقاً" }, { status: 409 })

  if (action === "reject") {
    await admin.from("orders").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id)
    return NextResponse.json({ ok: true })
  }

  await admin.from("orders").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", id)

  // Decrement the seller's available stock and activate the delivery ticket.
  if (order.offer_id) {
    const { data: offer } = await admin.from("offers").select("available").eq("id", order.offer_id).single()
    if (offer) {
      const remaining = Math.max(0, Number(offer.available) - Number(order.robux_amount))
      await admin.from("offers").update({ available: remaining }).eq("id", order.offer_id)
    }
  }
  await admin.from("tickets").update({ status: "open" }).eq("order_id", id)

  await notifyDiscord("orders", {
    title: "تم تأكيد الدفع وبدء تنفيذ الطلب",
    fields: [
      { name: "الكمية", value: `${Number(order.robux_amount).toLocaleString()} R$`, inline: true },
      { name: "حساب روبلوكس", value: order.roblox_username, inline: true },
    ],
  })

  return NextResponse.json({ ok: true })
}
