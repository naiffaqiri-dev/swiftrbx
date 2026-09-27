'use client'

import { useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/components/i18n/locale-provider'

type LogoutConfirmationProps = {
  onConfirm: () => Promise<void>
  trigger: (openDialog: () => void) => ReactNode
}

export function LogoutConfirmation({ onConfirm, trigger }: LogoutConfirmationProps) {
  const { t } = useLocale()
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  function openDialog() {
    setFailed(false)
    dialogRef.current?.showModal()
  }

  async function confirmLogout() {
    setPending(true)
    setFailed(false)
    try {
      await onConfirm()
      dialogRef.current?.close()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {trigger(openDialog)}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <h2 id={titleId} className="text-lg font-semibold">
              {t('auth.logout.confirmTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('auth.logout.confirmMessage')}
            </p>
            {failed && (
              <p role="alert" className="text-sm text-destructive">
                {t('auth.logout.failed')}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()} disabled={pending}>
              {t('common.no')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmLogout} disabled={pending}>
              {pending ? t('common.pleaseWait') : t('common.yes')}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
