'use client'

import { useState } from 'react'
import { Headphones, X, Loader2, CheckCircle2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/components/i18n/locale-provider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function SupportButton() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (message.trim().length < 3) {
      setError(t('support.errorMessage'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, contact }),
      })
      if (!res.ok) {
        setError(t('support.errorSend'))
        return
      }
      setSent(true)
      setMessage('')
      setContact('')
    } catch {
      setError(t('support.errorSend'))
    } finally {
      setLoading(false)
    }
  }

  function close() {
    setOpen(false)
    setTimeout(() => {
      setSent(false)
      setError('')
    }, 200)
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 gap-2 rounded-full shadow-[0_0_28px_-6px_var(--primary)]"
      >
        <Headphones className="size-4" />
        {t('support.button')}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-start bg-black/50 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={t('support.button')}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Headphones className="h-5 w-5 text-primary" />
                {t('support.button')}
              </h2>
              <button onClick={close} aria-label={t('support.close')} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {sent ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-primary" />
                <p className="font-medium">{t('support.sent')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('support.sentMessage')}</p>
                <Button className="mt-5 w-full" onClick={close}>
                  {t('support.done')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('support.prompt')}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="support-msg">{t('support.message')}</Label>
                  <Textarea
                    id="support-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('support.messagePlaceholder')}
                    rows={4}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support-contact">{t('support.contact')}</Label>
                  <Input
                    id="support-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={t('support.contactPlaceholder')}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full gap-2" onClick={submit} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('support.send')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
