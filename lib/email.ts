const RESEND_ENDPOINT = 'https://api.resend.com/emails'

function fromAddress() {
  const domain = process.env.RESEND_EMAIL_DOMAIN
  return domain ? `SwiftRBX <no-reply@${domain}>` : 'SwiftRBX <onboarding@resend.dev>'
}

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function codeEmailHtml(code: string, title: string, note: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0f;padding:32px;color:#e5e7eb">
    <div style="max-width:480px;margin:0 auto;background:#14141b;border:1px solid #26263a;border-radius:16px;padding:28px;text-align:center">
      <h1 style="margin:0 0 8px;font-size:20px;color:#a78bfa">SwiftRBX</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#9ca3af">${title}</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#fff;background:#1d1d29;border-radius:12px;padding:16px 0;margin-bottom:20px">${code}</div>
      <p style="margin:0;font-size:13px;color:#6b7280">${note}</p>
    </div>
  </div>`
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log('[v0] RESEND_API_KEY missing — cannot send email')
    return false
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress(), to, subject, html }),
    })
    if (!res.ok) {
      console.log('[v0] Resend send failed:', res.status, await res.text())
    }
    return res.ok
  } catch (e) {
    console.log('[v0] Resend send error:', (e as Error).message)
    return false
  }
}
