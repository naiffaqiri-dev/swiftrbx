'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { LockKeyhole } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { safeInternalPath } from '@/lib/auth-redirect'

export function AuthRequiredDialog({
  open,
  onOpenChange,
  returnTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnTo: string
}) {
  const next = safeInternalPath(returnTo, '/market')
  const loginHref = `/login?${new URLSearchParams({ next }).toString()}`
  const registerHref = `/register?${new URLSearchParams({ next }).toString()}`

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-foreground/55 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Popup dir="rtl" className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl outline-none sm:p-7">
            <div className="flex flex-col gap-3">
              <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <LockKeyhole className="size-5" />
              </span>
              <div className="flex flex-col gap-1.5">
                <Dialog.Title className="text-xl font-bold text-balance">يلزم تسجيل الدخول لإتمام الشراء</Dialog.Title>
                <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
                  يمكنك تصفح المتجر والمنتجات دون حساب. أنشئ حساباً أو سجّل الدخول للمتابعة وإتمام طلبك بأمان.
                </Dialog.Description>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href={registerHref} className={buttonVariants({ className: 'flex-1' })}>
                إنشاء حساب
              </Link>
              <Link href={loginHref} className={buttonVariants({ variant: 'outline', className: 'flex-1' })}>
                تسجيل الدخول
              </Link>
            </div>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
              متابعة التصفح
            </Button>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

