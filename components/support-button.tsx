'use client'

import { useState } from 'react'
import { Headphones, X, Loader2, CheckCircle2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function SupportButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (message.trim().length < 3) {
      setError('يرجى كتابة رسالتك أولاً')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, contact }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'تعذّر إرسال الرسالة')
        return
      }
      setSent(true)
      setMessage('')
      setContact('')
    } catch {
      setError('تعذّر إرسال الرسالة، حاول لاحقاً')
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
        الدعم المباشر
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-start bg-black/50 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="الدعم المباشر"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Headphones className="h-5 w-5 text-primary" />
                الدعم المباشر
              </h2>
              <button onClick={close} aria-label="إغلاق" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {sent ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-primary" />
                <p className="font-medium">تم إرسال رسالتك</p>
                <p className="mt-1 text-sm text-muted-foreground">سيتواصل معك فريق الدعم في أقرب وقت.</p>
                <Button className="mt-5 w-full" onClick={close}>
                  تم
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  اكتب استفسارك وسيصل مباشرةً إلى فريق الدعم على الديسكورد.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="support-msg">رسالتك</Label>
                  <Textarea
                    id="support-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="كيف يمكننا مساعدتك؟"
                    rows={4}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support-contact">وسيلة تواصل (اختياري)</Label>
                  <Input
                    id="support-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="ديسكورد / بريد / رقم"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full gap-2" onClick={submit} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  إرسال
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
