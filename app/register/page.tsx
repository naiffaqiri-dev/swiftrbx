'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { SocialButtons } from '@/components/auth/social-buttons'
import { useAuth } from '@/components/auth/mock-auth'
import { useLocale } from '@/components/i18n/locale-provider'
import { authRouteHref, getAuthReturnPath } from '@/lib/auth-redirect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { validatePassword } from '@/lib/password'

export default function RegisterPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { register } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [consentDialogOpen, setConsentDialogOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const consentCopy = {
    title: t('موافقة على السياسات والشروط'),
    description: t('قبل إنشاء حسابك، يرجى مراجعة سياسة الخصوصية وشروط الاستخدام والموافقة عليهما.'),
    privacy: t('سياسة الخصوصية'),
    terms: t('شروط الاستخدام'),
    reject: t('رفض'),
    accept: t('أوافق وأتابع إنشاء الحساب'),
  }

  async function completeRegistration() {
    const form = formRef.current
    if (!form) return

    setConsentDialogOpen(false)
    setLoading(true)
    setError(null)

    const formData = new FormData(form)
    try {
      const { error } = await register({
        username: String(formData.get('username') ?? '').trim(),
        displayName: String(formData.get('displayName') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
        privacyPolicyAccepted: true,
        termsOfUseAccepted: true,
      })
      if (error) {
        setError(error)
        return
      }
      router.replace(getAuthReturnPath())
    } catch {
      setError(t('تعذّر إنشاء الحساب، حاول مرة أخرى'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
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
      setError(t('اسم المستخدم بالإنجليزية فقط (أحرف وأرقام و _)، من 2 إلى 16 خانة'))
      return
    }
    if (displayName.length < 2) {
      setError(t('الاسم المستعار مطلوب (حرفان على الأقل)'))
      return
    }
    if (!email) {
      setError(t('البريد الإلكتروني مطلوب'))
      return
    }
    const pwError = validatePassword(password)
    if (pwError) {
      setError(t(pwError))
      return
    }
    if (password !== confirm) {
      setError(t('كلمتا المرور غير متطابقتين'))
      return
    }

    setConsentDialogOpen(true)
  }

  return (
    <AuthShell
      title={t('auth.register')}
      subtitle={t('انضم إلى SwiftRBX وابدأ الشراء خلال دقائق.')}
      footer={
        <>
          {t('لديك حساب بالفعل؟')}{' '}
          <Link
            href="/login"
            onClick={(event) => {
              event.preventDefault()
              router.push(authRouteHref('/login', getAuthReturnPath()))
            }}
            className="font-semibold text-primary hover:underline"
          >
            {t('سجّل الدخول')}
          </Link>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName">{t('الاسم المستعار')}</Label>
          <Input
            id="displayName"
            name="displayName"
            placeholder="مثال: نايف"
            required
            maxLength={24}
            autoComplete="nickname"
          />
          <p className="text-xs text-muted-foreground">
            {t('الاسم الظاهر للآخرين، ويمكن تغييره لاحقاً.')}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="username">{t('اسم المستخدم')}</Label>
          <Input
            id="username"
            name="username"
            placeholder="username"
            required
            dir="ltr"
            pattern="[A-Za-z0-9_]{2,16}"
            title={t('بالإنجليزية فقط: أحرف وأرقام و _ ، من 2 إلى 16 خانة')}
            autoComplete="username"
          />
          <p className="text-xs text-muted-foreground">
            {t('بالإنجليزية فقط (أحرف وأرقام و _)، من 2 إلى 16 خانة. لا يمكن استخدام اسم مأخوذ مسبقاً.')}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t('البريد الإلكتروني')}</Label>
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
            {t('نستخدمه لاستعادة كلمة المرور والتحقق بخطوتين.')}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t('كلمة المرور')}</Label>
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
              aria-label={showPassword ? t('إخفاء كلمة المرور') : t('إظهار كلمة المرور')}
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
          <Label htmlFor="confirm">{t('تأكيد كلمة المرور')}</Label>
          <Input
            id="confirm"
            name="confirm"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />
        </div>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">{t('الموافقة على السياسات')}</legend>
          <div className="flex items-start gap-3">
            <input
              id="privacyPolicyAccepted"
              type="checkbox"
              checked={privacyAccepted}
              onChange={(event) => setPrivacyAccepted(event.target.checked)}
              aria-label={t('أوافق على سياسة الخصوصية')}
              className="mt-1 size-4 shrink-0 accent-success focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <p className="text-sm leading-relaxed">
              <label htmlFor="privacyPolicyAccepted">{t('أوافق على قراءة')}</label>{' '}
              <Link href="/privacy" className="font-semibold text-success underline underline-offset-4 hover:text-success/80">
                {t('سياسة الخصوصية')}
              </Link>
            </p>
          </div>
          <div className="flex items-start gap-3">
            <input
              id="termsOfUseAccepted"
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              aria-label={t('أوافق على شروط الاستخدام')}
              className="mt-1 size-4 shrink-0 accent-success focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <p className="text-sm leading-relaxed">
              <label htmlFor="termsOfUseAccepted">{t('أوافق على قراءة')}</label>{' '}
              <Link href="/terms" className="font-semibold text-success underline underline-offset-4 hover:text-success/80">
                {t('شروط الاستخدام')}
              </Link>
            </p>
          </div>
        </fieldset>

        <Button
          type="submit"
          disabled={loading}
          className="w-full gap-2 shadow-[0_0_24px_-6px_var(--primary)]"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? t('جارٍ الإنشاء…') : t('إنشاء الحساب')}
        </Button>

      </form>

      <Dialog.Root open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-foreground/55 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Popup dir="rtl" className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl outline-none">
              <div className="flex flex-col gap-2">
                <Dialog.Title className="text-xl font-bold text-balance">{consentCopy.title}</Dialog.Title>
                <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
                  {consentCopy.description}
                </Dialog.Description>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4 text-sm">
                <Link href="/privacy" className="font-semibold text-success underline underline-offset-4 hover:text-success/80">
                  {consentCopy.privacy}
                </Link>
                <Link href="/terms" className="font-semibold text-success underline underline-offset-4 hover:text-success/80">
                  {consentCopy.terms}
                </Link>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setConsentDialogOpen(false)} disabled={loading}>
                  {consentCopy.reject}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setPrivacyAccepted(true)
                    setTermsAccepted(true)
                    void completeRegistration()
                  }}
                  disabled={loading}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  {loading && <Loader2 aria-hidden="true" data-icon="inline-start" className="animate-spin" />}
                  {consentCopy.accept}
                </Button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">{t('أو تابع عبر')}</span>
        <Separator className="flex-1" />
      </div>

      <SocialButtons />
    </AuthShell>
  )
}
