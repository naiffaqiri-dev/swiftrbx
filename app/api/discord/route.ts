import { NextResponse } from 'next/server'

const WEBHOOKS: Record<string, string | undefined> = {
  orders: process.env.DISCORD_WEBHOOK_MAIN_ORDERS,
  suppliers: process.env.DISCORD_WEBHOOK_SUPPLIERS,
  suppliers_support: process.env.DISCORD_WEBHOOK_SUPPLIERS_SUPPORT,
  support: process.env.DISCORD_WEBHOOK_SUPPORT,
}

export async function POST(req: Request) {
  try {
    const { channel, content } = (await req.json()) as {
      channel?: string
      content?: string
    }

    if (!channel || !content) {
      return NextResponse.json({ error: 'channel و content مطلوبان' }, { status: 400 })
    }

    const url = WEBHOOKS[channel]
    if (!url) {
      // القناة غير مُعرّفة أو الـ webhook غير مضبوط — نتجاهل بهدوء
      return NextResponse.json({ ok: false, skipped: true })
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, username: 'SwiftRBX' }),
    })

    return NextResponse.json({ ok: res.ok })
  } catch {
    return NextResponse.json({ error: 'فشل الإرسال' }, { status: 500 })
  }
}
