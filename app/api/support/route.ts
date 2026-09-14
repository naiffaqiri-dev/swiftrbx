import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  let body: { message?: string; contact?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const message = String(body.message ?? '').trim()
  const contact = String(body.contact ?? '').trim()
  if (message.length < 3) {
    return NextResponse.json({ error: 'يرجى كتابة رسالتك' }, { status: 400 })
  }

  let username = 'زائر'
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, email')
        .eq('id', user.id)
        .maybeSingle()
      username = profile?.username ?? user.email ?? 'مستخدم'
    }
  } catch {
    // نتابع كزائر
  }

  const url = process.env.DISCORD_WEBHOOK_SUPPORT
  if (!url) {
    return NextResponse.json({ error: 'الدعم غير متاح حالياً' }, { status: 503 })
  }

  const content = [
    '**طلب دعم جديد**',
    `**من:** ${username}`,
    contact ? `**وسيلة التواصل:** ${contact}` : null,
    `**الرسالة:** ${message}`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, username: 'SwiftRBX Support' }),
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'تعذّر إرسال الرسالة' }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: 'تعذّر إرسال الرسالة' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
