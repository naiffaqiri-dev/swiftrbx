'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ArrowLeft, ArrowRight, Loader2, MessageSquareQuote, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/components/i18n/locale-provider'
import { StarInput } from '@/components/reviews/star-rating'

export function OrderConfirmationDialog({
  orderId,
  open,
  onOpenChange,
  onComplete,
}: {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}) {
  const { lang, dir } = useLocale()
  const isEnglish = lang === 'en'
  const [step, setStep] = useState<'seller' | 'site'>('seller')
  const [sellerRating, setSellerRating] = useState(0)
  const [sellerComment, setSellerComment] = useState('')
  const [siteRating, setSiteRating] = useState(0)
  const [siteComment, setSiteComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function close() {
    if (saving) return
    onOpenChange(false)
    setStep('seller')
    setSellerRating(0)
    setSellerComment('')
    setSiteRating(0)
    setSiteComment('')
    setError('')
  }

  async function submit() {
    if (sellerRating < 1 || siteRating < 1 || siteComment.trim().length < 3 || saving) return
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          action: 'confirm',
          rating: sellerRating,
          comment: sellerComment.trim(),
          siteRating,
          siteComment: siteComment.trim(),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.ok) throw new Error(result.error || (isEnglish ? 'Could not confirm receipt. Please try again.' : 'تعذّر تأكيد الاستلام، حاول مرة أخرى'))
      onOpenChange(false)
      onComplete()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isEnglish ? 'Something went wrong. Please try again.' : 'حدث خطأ، حاول مرة أخرى'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (nextOpen) onOpenChange(true); else close() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-foreground/55 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
          <Dialog.Popup dir={dir} className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl outline-none sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <Dialog.Title className="text-xl font-bold text-balance">
                  {step === 'seller'
                    ? (isEnglish ? 'Rate the seller' : 'قيّم البائع')
                    : (isEnglish ? 'Rate your experience with SwiftRBX' : 'قيّم تجربتك مع الموقع')}
                </Dialog.Title>
                <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
                  {step === 'seller'
                    ? (isEnglish ? 'Confirm receipt and tell us about your experience with the seller.' : 'أكد استلام طلبك وأخبرنا عن تجربتك مع البائع.')
                    : (isEnglish ? 'Your feedback helps us improve the whole website.' : 'رأيك يساعدنا على تحسين الموقع بالكامل.')}
                </Dialog.Description>
              </div>
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {step === 'seller' ? <Star className="size-5" /> : <MessageSquareQuote className="size-5" />}
              </span>
            </div>

            <div className="flex items-center gap-2" aria-label={isEnglish ? 'Review step' : 'خطوة التقييم'}>
              <span className={`h-1.5 flex-1 rounded-full ${step === 'seller' ? 'bg-primary' : 'bg-primary/30'}`} />
              <span className={`h-1.5 flex-1 rounded-full ${step === 'site' ? 'bg-primary' : 'bg-muted'}`} />
              <span className="sr-only">{step === 'seller' ? (isEnglish ? 'Step 1 of 2' : 'الخطوة 1 من 2') : (isEnglish ? 'Step 2 of 2' : 'الخطوة 2 من 2')}</span>
            </div>

            {step === 'seller' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-5">
                  <p className="text-sm font-medium">{isEnglish ? 'How was the seller?' : 'كيف كانت تجربتك مع البائع؟'}</p>
                  <StarInput value={sellerRating} onChange={setSellerRating} />
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium" htmlFor={`seller-review-${orderId}`}>
                  {isEnglish ? 'Comment (optional)' : 'تعليق (اختياري)'}
                  <textarea
                    id={`seller-review-${orderId}`}
                    value={sellerComment}
                    onChange={(event) => setSellerComment(event.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder={isEnglish ? 'Share a few details…' : 'اكتب تفاصيل إضافية…'}
                    className="w-full resize-none rounded-lg border border-border/60 bg-background p-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-5">
                  <p className="text-sm font-medium">{isEnglish ? 'How would you rate the whole website?' : 'ما تقييمك للموقع بالكامل؟'}</p>
                  <StarInput value={siteRating} onChange={setSiteRating} />
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium" htmlFor={`site-review-${orderId}`}>
                  {isEnglish ? 'Tell us about your experience' : 'شاركنا رأيك في تجربتك'}
                  <textarea
                    id={`site-review-${orderId}`}
                    value={siteComment}
                    onChange={(event) => setSiteComment(event.target.value)}
                    rows={3}
                    minLength={3}
                    maxLength={500}
                    placeholder={isEnglish ? 'What did you think of the website?' : 'كيف كانت تجربتك مع الموقع؟'}
                    className="w-full resize-none rounded-lg border border-border/60 bg-background p-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
              </div>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" onClick={close} disabled={saving}>
                {isEnglish ? 'Cancel' : 'إلغاء'}
              </Button>
              {step === 'seller' ? (
                <Button type="button" onClick={() => { setError(''); setStep('site') }} disabled={sellerRating < 1} className="gap-2">
                  {isEnglish ? 'Continue' : 'متابعة'}
                  {isEnglish ? <ArrowRight data-icon="inline-end" /> : <ArrowLeft data-icon="inline-end" />}
                </Button>
              ) : (
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => { setError(''); setStep('seller') }} disabled={saving} className="gap-2">
                    {isEnglish ? <ArrowLeft data-icon="inline-start" /> : <ArrowRight data-icon="inline-start" />}
                    {isEnglish ? 'Back' : 'رجوع'}
                  </Button>
                  <Button type="button" onClick={submit} disabled={saving || siteRating < 1 || siteComment.trim().length < 3} className="gap-2">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    {saving ? (isEnglish ? 'Confirming…' : 'جارٍ التأكيد…') : (isEnglish ? 'Confirm receipt' : 'تأكيد الاستلام')}
                  </Button>
                </div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
