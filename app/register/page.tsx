'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { SocialButtons } from '@/components/auth/social-buttons'
import { useAuth } from '@/components/auth/mock-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

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
    const email =
      (form.elements.namedItem('email') as HTMLInputElement)?.value.trim() || undefined
    const password =
      (form.elements.namedItem('password') as HTMLInputElement)?.value ?? ''

    setLoading(true)
    const { error } = await register({ username, email, password })
    if (error) {
      setError(error)
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <AuthShell
      title="إنشاء حساب"
      subtitle="انضم إلى SwiftRBX وابدأ الشراء خلال دقائق. البريد الإلكتروني اختياري."
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link
            href="/login"
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
          <Label htmlFor="username">اسم المستخدم</Label>
          <Input
            id="username"
            name="username"
            placeholder="اختر اسم مستخدم"
            required
            autoComplete="username"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">
            البريد الإلكتروني{' '}
            <span className="text-xs text-muted-foreground">(اختياري)</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">
            إن أضفت بريداً، سنرسل لك رسالة تحقق لتأمين حسابك.
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
