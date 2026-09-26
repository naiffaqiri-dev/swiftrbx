'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validatePassword } from '@/lib/password'
import { BrandLogo } from '@/components/brand-logo'

export function OnboardingForm({
  defaultEmail,
  provider,
}: {
  defaultEmail: string
  provider: string
}) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget as HTMLFormElement
    const username = (form.elements.namedItem('username') as HTMLInputElement)?.value.trim() ?? ''
    const displayName = (form.elements.namedItem('displayName') as HTMLInputElement)?.value.trim() ?? ''
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value.trim() ?? ''
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? ''
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement)?.value ?? ''

    if (!/^[A-Za-z0-9_]{2,16}$/.test(username)) {
      setError('اسم المستخدم بالإنجليزية فقط (أحرف وأرقام و _)، من 2 إلى 16 خانة')
      return
    }
    if (displayName.length < 2) {
      setError('الاسم المستعار مطلوب (حرفان على الأقل)')
      return
    }
    if (!email) {
      setError('البريد الإلكتروني مطلوب')
      return
    }
    const pwError = validatePassword(password)
    if (pwError) {
      setError(pwError)
      return
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'تعذّر إكمال إنشاء الحساب')
        setLoading(false)
        return
      }
      // إعادة تحميل كاملة حتى يلتقط سياق المصادقة الملف المحدّث
      window.location.href = '/dashboard'
    } catch {
      setError('تعذّر الاتصال، حاول لاحقاً')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <BrandLogo />
        <div>
          <h1 className="text-2xl font-bold text-balance">أكمل إنشاء حسابك</h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            سجّلت الدخول عبر {provider}. أكمل بياناتك مرة واحدة فقط — ستُحفظ دائماً حتى لو دخلت من جهاز آخر.
          </p>
        </div>
      </div>

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
          <Label htmlFor="displayName">الاسم المستعار</Label>
          <Input id="displayName" name="displayName" placeholder="مثال: نايف" required maxLength={24} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="username">اسم المستخدم</Label>
          <Input
            id="username"
            name="username"
            placeholder="username"
            required
            dir="ltr"
            pattern="[A-Za-z0-9_]{2,16}"
            title="بالإنجليزية فقط: أحرف وأرقام و _ ، من 2 إلى 16 خانة"
          />
          <p className="text-xs text-muted-foreground">
            بالإنجليزية فقط (أحرف وأرقام و _)، من 2 إلى 16 خانة. لا يمكن استخدام اسم مأخوذ.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultEmail}
            placeholder="you@example.com"
            required
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">
            {defaultEmail ? 'تم ملؤه تلقائياً من حسابك، ويمكنك تعديله.' : 'أدخل بريدك الإلكتروني.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
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
          <p className="text-xs text-muted-foreground">
            8 خانات على الأقل، وتحتوي على حروف وأرقام وعلامة واحدة على الأقل (مثل @ # ! _).
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
          <Input id="confirm" name="confirm" type={showPassword ? 'text' : 'password'} placeholder="••••••••" required />
        </div>

        <Button type="submit" disabled={loading} className="w-full gap-2 shadow-[0_0_24px_-6px_var(--primary)]">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? 'جارٍ الحفظ…' : 'إنشاء الحساب'}
        </Button>
      </form>
    </div>
  )
}
