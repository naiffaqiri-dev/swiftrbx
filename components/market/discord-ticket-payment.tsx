'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/components/auth/mock-auth'
import { AuthRequiredDialog } from '@/components/auth/auth-required-dialog'
import { prepareReceiptImage, ReceiptImageError } from '@/lib/receipt-image'
import { formatSar } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Loader2, Upload } from 'lucide-react'

type PaymentView = {
  robuxAmount: number
  robloxUsername: string
  deliveryMethod: string
  sellerName: string
  totalSar: number
  expiresAt: string
  bank: { name: string | null; account: string | null; iban: string | null; holder: string | null }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function fetchPayment([, token]: [string, string]): Promise<PaymentView> {
  const response = await fetch('/api/discord-ticket-payments/lookup', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? 'تعذّر تحميل بيانات الطلب')
  return body.payment as PaymentView
}

export function DiscordTicketPayment({ token }: { token: string }) {
  const { user, ready } = useAuth()
  const { data: payment, error: loadError } = useSWR(
    user ? ['discord-ticket-payment', token] : null,
    fetchPayment,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [senderName, setSenderName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function uploadReceipt(file: File | undefined) {
    if (!file || uploading) return
    setUploading(true)
    setError('')
    try {
      const prepared = await prepareReceiptImage(file)
      const form = new FormData()
      form.append('receipt', prepared, file.name)
      const response = await fetch('/api/catalog/receipt', { method: 'POST', body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'تعذّر رفع الإيصال')
      setReceiptPath(body.receiptPath as string)
    } catch (cause) {
      setError(cause instanceof ReceiptImageError || cause instanceof Error ? cause.message : 'تعذّر رفع الإيصال')
    } finally {
      setUploading(false)
    }
  }

  async function submitReceipt() {
    if (!receiptPath || !senderName.trim()) {
      setError('ارفع صورة الإيصال وأدخل اسم المحوّل.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/discord-ticket-payments/submit', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ token, receiptPath, senderName: senderName.trim() }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'تعذّر إرسال الإيصال')
      setSubmitted(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر إرسال الإيصال')
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) {
    return <p role="status" className="text-center text-muted-foreground">جارٍ التحقق من الحساب…</p>
  }

  if (!user) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
        <p className="text-muted-foreground">سجّل الدخول للمتابعة وإرسال إيصال التحويل.</p>
        <AuthRequiredDialog
          open
          onOpenChange={() => undefined}
          returnTo={`/checkout?${new URLSearchParams({ discordTicketPayment: token }).toString()}`}
        />
      </div>
    )
  }

  if (loadError) {
    return (
      <div role="alert" className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
        <p className="text-muted-foreground">{loadError.message}</p>
      </div>
    )
  }

  if (!payment) {
    return <p role="status" className="text-center text-muted-foreground">جارٍ تحميل بيانات الطلب…</p>
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-primary/40 bg-primary/5 p-10 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-primary" aria-hidden="true" />
        <h2 className="mb-2 text-2xl font-bold">تم استلام الإيصال</h2>
        <p className="text-muted-foreground">سيتم مراجعة التحويل وإرسال تأكيد الطلب في ديسكورد.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
      <section aria-labelledby="payment-summary" className="rounded-2xl border border-border/60 bg-card/40 p-6">
        <h2 id="payment-summary" className="mb-4 text-lg font-bold">ملخص الطلب</h2>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">الكمية</dt>
            <dd className="font-semibold">{payment.robuxAmount.toLocaleString('en-US')} Robux</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">اسم المستخدم في روبلوكس</dt>
            <dd className="font-semibold">{payment.robloxUsername}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">البائع</dt>
            <dd className="font-semibold">{payment.sellerName}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border/60 pt-3">
            <dt className="text-muted-foreground">المبلغ المطلوب</dt>
            <dd className="text-lg font-extrabold">{formatSar(payment.totalSar)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="bank-details" className="rounded-2xl border border-border/60 bg-card/40 p-6">
        <h2 id="bank-details" className="mb-4 text-lg font-bold">بيانات التحويل</h2>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">البنك</dt>
            <dd className="font-semibold">{payment.bank.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">رقم الحساب</dt>
            <dd className="font-mono font-semibold" dir="ltr">{payment.bank.account}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">الآيبان</dt>
            <dd className="font-mono font-semibold" dir="ltr">{payment.bank.iban}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">اسم الحساب</dt>
            <dd className="font-semibold">{payment.bank.holder}</dd>
          </div>
        </dl>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="discord-sender">اسم المحوّل</Label>
            <Input
              id="discord-sender"
              value={senderName}
              onChange={(event) => setSenderName(event.target.value)}
              placeholder="الاسم كما في الحوالة"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="discord-receipt">صورة الإيصال</Label>
            <label
              htmlFor="discord-receipt"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              {receiptPath ? 'تم رفع الإيصال، اضغط لتغييره' : 'اختر صورة الإيصال'}
            </label>
            <input
              id="discord-receipt"
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => void uploadReceipt(event.target.files?.[0])}
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={() => void submitReceipt()}
            disabled={submitting || uploading || !receiptPath || !senderName.trim()}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            إرسال الإيصال
          </Button>
        </div>
      </section>
    </div>
  )
}
