import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { useLocale } from '@/components/i18n/locale-provider'
import { buttonVariants } from '@/components/ui/button'

export default function AuthErrorPage() {
  const { t } = useLocale()

  return (
    <AuthShell
      title={t('تعذّر إكمال العملية')}
      subtitle={t('حدثت مشكلة أثناء المصادقة.')}
      footer={
        <>
          {t('هل تحتاج مساعدة؟')}{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t('العودة لتسجيل الدخول')}
          </Link>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('انتهت صلاحية الرابط أو أنه غير صالح. يمكنك المحاولة من جديد أو طلب رابط جديد لإعادة تعيين كلمة المرور.')}
        </p>
        <div className="flex w-full flex-col gap-2">
          <Link href="/login" className={buttonVariants({ className: 'w-full' })}>
            {t('تسجيل الدخول')}
          </Link>
          <Link href="/forgot-password" className={buttonVariants({ variant: 'secondary', className: 'w-full' })}>
            {t('طلب رابط استعادة جديد')}
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
