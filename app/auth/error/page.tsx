import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'

export default function AuthErrorPage() {
  return (
    <AuthShell
      title="تعذّر إكمال العملية"
      subtitle="حدثت مشكلة أثناء المصادقة."
      footer={
        <>
          هل تحتاج مساعدة؟{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            العودة لتسجيل الدخول
          </Link>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          انتهت صلاحية الرابط أو أنه غير صالح. يمكنك المحاولة من جديد أو طلب رابط
          جديد لإعادة تعيين كلمة المرور.
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button asChild className="w-full">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/forgot-password">طلب رابط استعادة جديد</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  )
}
