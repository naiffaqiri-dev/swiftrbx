'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget as HTMLFormElement
    const email =
      (form.elements.namedItem('email') as HTMLInputElement)?.value.trim() ?? ''
    if (!email) {
      setError('يرجى إدخال البريد الإلكتروني')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: 'https://www.swiftrbx.site/reset-password',
    })
    setLoading(false)

    if (error) {
      setError('تعذّر إرسال رابط الاستعادة، حاول مرة أخرى لاحقاً')
      return
    }
    // نعرض رسالة نجاح موحّدة دائماً لمنع كشف الحسابات المسجّلة
    setSent(true)
  }

  return (
    <AuthShell
      title="استعادة كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور."
      footer={
        <>
          تذكّرت كلمة المرور؟{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            العودة لتسجيل الدخول
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-7" />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            إن كان هناك حساب مرتبط بهذا البريد، فقد أرسلنا إليه رابطاً لإعادة تعيين
            كلمة المرور. تحقق من صندوق الوارد ومجلد الرسائل غير المرغوبة.
          </p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/login">العودة لتسجيل الدخول</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2 shadow-[0_0_24px_-6px_var(--primary)]"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'جارٍ الإرسال…' : 'إرسال رابط الاستعادة'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
