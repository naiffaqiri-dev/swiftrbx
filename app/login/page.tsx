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

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const form = e.currentTarget as HTMLFormElement
    const identifier =
      (form.elements.namedItem('identifier') as HTMLInputElement)?.value.trim() ||
      'dego'
    // جلسة تجريبية — سيتم ربطها بقاعدة البيانات لاحقاً
    setTimeout(() => {
      login(
        identifier.includes('@') ? identifier.split('@')[0] : identifier,
        identifier.includes('@') ? identifier : undefined,
      )
      router.push('/dashboard')
    }, 700)
  }

  return (
    <AuthShell
      title="تسجيل الدخول"
      subtitle="أهلاً بعودتك! سجّل دخولك لمتابعة طلباتك ورصيدك."
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link
            href="/register"
            className="font-semibold text-primary hover:underline"
          >
            أنشئ حساباً الآن
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier">اسم المستخدم أو البريد الإلكتروني</Label>
          <Input
            id="identifier"
            name="identifier"
            placeholder="مثال: dego"
            required
            autoComplete="username"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">كلمة المرور</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
              autoComplete="current-password"
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
          {loading ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
        </Button>
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
