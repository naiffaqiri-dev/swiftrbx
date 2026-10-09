'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ArrowLeftRight, CircleCheck, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/auth/mock-auth'
import { useLocale } from '@/components/i18n/locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TransferStage = 'form' | 'confirm' | 'success'

export function BalanceTransferButton() {
  const { user, refresh } = useAuth()
  const { t, dir } = useLocale()
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<TransferStage>('form')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const requestId = useRef<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (nextOpen) {
      setStage('form')
      setRecipient('')
      setAmount('')
      setError('')
      requestId.current = null
    }
  }

  function reviewTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const normalizedRecipient = recipient.trim()
    const numericAmount = Number(amount)
    if (!/^[A-Za-z0-9_]{2,16}$/.test(normalizedRecipient)) {
      setError(t('balanceTransfer.invalidUsername'))
      return
    }
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amount) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(t('balanceTransfer.invalidAmount'))
      return
    }
    if (normalizedRecipient.toLowerCase() === user?.username.toLowerCase()) {
      setError(t('balanceTransfer.selfTransfer'))
      return
    }
    if (numericAmount > (user?.balance ?? 0)) {
      setError(t('balanceTransfer.insufficientBalance'))
      return
    }

    setRecipient(normalizedRecipient)
    setStage('confirm')
  }

  async function confirmTransfer() {
    if (!user) return
    setPending(true)
    setError('')
    requestId.current ??= globalThis.crypto.randomUUID()

    try {
      const response = await fetch('/api/account/balance-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUsername: recipient, amount, requestId: requestId.current }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(t(payload?.error ?? 'balanceTransfer.failed'))
        return
      }

      requestId.current = null
      setStage('success')
      await refresh().catch(() => undefined)
    } catch {
      setError(t('balanceTransfer.connectionError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        render={<Button type="button" variant="outline" size="sm" />}
        aria-label={t('balanceTransfer.open')}
        title={t('balanceTransfer.open')}
        className="shrink-0 gap-1.5 rounded-full"
      >
        <ArrowLeftRight aria-hidden="true" data-icon="inline-start" />
        <span>{t('balanceTransfer.open')}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-foreground/55 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
          <Dialog.Popup dir={dir} className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl outline-none sm:p-6">
            <div className="flex flex-col gap-2">
              <Dialog.Title className="text-lg font-bold">
                {stage === 'success' ? t('balanceTransfer.successTitle') : t('balanceTransfer.title')}
              </Dialog.Title>
              <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
                {stage === 'form' && t('balanceTransfer.description')}
                {stage === 'confirm' && t('balanceTransfer.confirmDescription')}
                {stage === 'success' && t('balanceTransfer.successDescription')}
              </Dialog.Description>
            </div>

            {stage === 'form' && (
              <form className="flex flex-col gap-4" onSubmit={reviewTransfer}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="transfer-recipient">{t('balanceTransfer.username')}</Label>
                  <Input
                    id="transfer-recipient"
                    autoComplete="off"
                    autoCapitalize="none"
                    maxLength={16}
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder={t('balanceTransfer.usernamePlaceholder')}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="transfer-amount">{t('balanceTransfer.amount')}</Label>
                  <Input
                    id="transfer-amount"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={13}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="50.00"
                    aria-describedby="transfer-balance-hint"
                    required
                  />
                  <p id="transfer-balance-hint" className="text-xs leading-relaxed text-muted-foreground">
                    {t('balanceTransfer.available')}: {user?.balance.toFixed(2)} $
                  </p>
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Dialog.Close render={<Button type="button" variant="outline" disabled={pending} />}>
                    {t('common.no')}
                  </Dialog.Close>
                  <Button type="submit" disabled={pending}>
                    {t('balanceTransfer.review')}
                  </Button>
                </div>
              </form>
            )}

            {stage === 'confirm' && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
                  <p className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{t('balanceTransfer.to')}</span>
                    <span className="font-semibold">@{recipient}</span>
                  </p>
                  <p className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{t('balanceTransfer.amount')}</span>
                    <span className="font-semibold">{Number(amount).toFixed(2)} $</span>
                  </p>
                  <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                    {t('balanceTransfer.irreversible')}
                  </p>
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" disabled={pending} onClick={() => { setError(''); setStage('form') }}>
                    {t('balanceTransfer.back')}
                  </Button>
                  <Button type="button" disabled={pending} onClick={confirmTransfer}>
                    {pending ? <Loader2 aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : <ArrowLeftRight aria-hidden="true" data-icon="inline-start" />}
                    {pending ? t('common.pleaseWait') : t('balanceTransfer.confirmSend')}
                  </Button>
                </div>
              </div>
            )}

            {stage === 'success' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4">
                  <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed">
                    {t('balanceTransfer.sent')} {Number(amount).toFixed(2)} $ {t('balanceTransfer.to')} @{recipient}
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => handleOpenChange(false)}>
                    {t('support.done')}
                  </Button>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
