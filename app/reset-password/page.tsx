'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // يُطلق عند اكتشاف رمز الاستعادة في hash الرابط (التدفق الضمني)
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true)
        setReady(true)
      }
    })

    async function establishSession() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const tokenHash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type')

      try {
        if (code) {
          // تدفق PKCE: نبادل الرمز بجلسة
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) {
            setHasSession(true)
            setReady(true)
            return
          }
        } else if (tokenHash && type) {
          // تدفق token_hash: نتحقّق من الرمز مباشرةً
          const { error } = await supabase.auth.verifyOtp({
            type: type as 'recovery',
            token_hash: tokenHash,
          })
          if (!error) {
            setHasSession(true)
            setReady(true)
            return
          }
        }
      } catch {
        // نتجاهل ونعتمد على الجلسة الحالية أدناه
      }

      // احتياطياً: التدفق الضمني (hash) يُعالَج تلقائياً بواسطة العميل
      const { data } = await supabase.auth.getSession()
      setHasSession(!!data.session)
      setReady(true)
    }

    establishSession()

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget as HTMLFormElement
    const password =
      (form.elements.namedItem('password') as HTMLInputElement)?.value ?? ''
    const confirm =
      (form.elements.namedItem('confirm') as HTMLInputElement)?.value ?? ''

    if (password.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 أحرف')
      return
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('تعذّر تحديث كلمة المرور، قد يكون الرابط منتهي الصلاحية')
      return
    }
    router.push('/dashboard')
  }

  return (
    <AuthShell
      title="تعيين كلمة مرور جديدة"
      subtitle="اختر كلمة مرور قوية جديدة لحسابك."
      footer={
        <>
          عدت للعمل؟{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      {ready && !hasSession ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            انتهت صلاحية رابط الاستعادة أو أنه غير صالح. يرجى طلب رابط جديد.
          </p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/forgot-password">طلب رابط جديد</Link>
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
            <Label htmlFor="password">كلمة المرور الجديدة</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
            <Input
              id="confirm"
              name="confirm"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !ready}
            className="w-full gap-2 shadow-[0_0_24px_-6px_var(--primary)]"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
