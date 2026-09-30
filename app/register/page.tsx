'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { SocialButtons } from '@/components/auth/social-buttons'
import { useAuth } from '@/components/auth/mock-auth'
import { authRouteHref, getAuthReturnPath } from '@/lib/auth-redirect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { validatePassword } from '@/lib/password'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget as HTMLFormElement
    const username =
      (form.elements.namedItem('username') as HTMLInputElement)?.value.trim() ?? ''
    const displayName =
      (form.elements.namedItem('displayName') as HTMLInputElement)?.value.trim() ?? ''
    const email =
      (form.elements.namedItem('email') as HTMLInputElement)?.value.trim() ?? ''
    const password =
      (form.elements.namedItem('password') as HTMLInputElement)?.value ?? ''
    const confirm =
      (form.elements.namedItem('confirm') as HTMLInputElement)?.value ?? ''

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
    const { error } = await register({ username, displayName, email, password })
    if (error) {
      setError(error)
      setLoading(false)
      return
    }
    router.replace(getAuthReturnPath())
  }

  return (
    <AuthShell
      title="إنشاء حساب"
      subtitle="انضم إلى SwiftRBX وابدأ الشراء خلال دقائق."
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link
            href="/login"
            onClick={(event) => {
              event.preventDefault()
              router.push(authRouteHref('/login', getAuthReturnPath()))
            }}
            className="font-semibold text-primary hover:underline"
          >
            سجّل الدخول
          </Link>
        </>
      }
    >
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
          <Input
            id="displayName"
            name="displayName"
            placeholder="مثال: نايف"
            required
            maxLength={24}
            autoComplete="nickname"
          />
          <p className="text-xs text-muted-foreground">
            الاسم الظاهر للآخرين، ويمكن تغييره لاحقاً.
          </p>
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
            autoComplete="username"
          />
          <p className="text-xs text-muted-foreground">
            بالإنجليزية فقط (أحرف وأرقام و _)، من 2 إلى 16 خانة. لا يمكن استخدام اسم مأخوذ مسبقاً.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            dir="ltr"
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">
            نستخدمه لاستعادة كلمة المرور والتحقق بخطوتين.
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
              autoComplete="new-password"
              className="pl-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            8 خانات على الأقل، وتحتوي على حروف وأرقام وعلامة واحدة على الأقل (مثل @ # ! _).
          </p>
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
          disabled={loading}
          className="w-full gap-2 shadow-[0_0_24px_-6px_var(--primary)]"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          بإنشائك للحساب فأنت توافق على{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            سياسة الخصوصية
          </Link>
          .
        </p>
      </form>

      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">أو تابع عبر</span>
        <Separator className="flex-1" />
      </div>

      <SocialButtons />
    </AuthShell>
  )
}
