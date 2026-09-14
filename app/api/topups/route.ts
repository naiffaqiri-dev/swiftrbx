import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBank } from "@/lib/banks"
import { notifyDiscord } from "@/lib/discord"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 })

  const amount = Number(body.amountSar ?? 0)
  const { bankKey, receiptUrl = null, senderName = null } = body

  if (!(amount > 0) || amount > 100000)
    return NextResponse.json({ error: "مبلغ غير صالح" }, { status: 400 })
  if (!getBank(bankKey)) return NextResponse.json({ error: "بيانات البنك غير صالحة" }, { status: 400 })

  const admin = createAdminClient()
  const { data: topup, error } = await admin
    .from("top_ups")
    .insert({
      user_id: user.id,
      amount_sar: amount,
      bank_key: bankKey,
      receipt_url: receiptUrl,
      sender_name: senderName,
      status: "confirming",
    })
    .select()
    .single()

  if (error || !topup) return NextResponse.json({ error: "تعذّر إنشاء طلب الشحن" }, { status: 500 })

  await notifyDiscord("orders", {
    title: "طلب شحن رصيد بانتظار التأكيد",
    fields: [
      { name: "المبلغ", value: `${amount} SAR`, inline: true },
      { name: "المحوّل", value: senderName ?? "-", inline: true },
    ],
  })

  return NextResponse.json({ topupId: topup.id, status: "confirming" })
}
