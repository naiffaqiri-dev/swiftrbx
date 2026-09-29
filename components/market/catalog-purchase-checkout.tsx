'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { BANKS, randomBank } from '@/lib/banks'
import { formatSar } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CatalogItem } from '@/lib/catalog'
import { CheckCircle2, Clock3, Copy, Landmark, Loader2, Upload, Wallet, X } from 'lucide-react'

export function CatalogPurchaseCheckout({
  item,
  onCancel,
  onComplete,
}: {
  item: CatalogItem
  onCancel: () => void
  onComplete: (ticketId: string) => void
}) {
  const { user } = useAuth()
  const [useBalance, setUseBalance] = useState(true)
  const [bank, setBank] = useState(() => randomBank())
  const [senderName, setSenderName] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const price = Number(item.price_sar ?? 0)
  const balance = Number(user?.balance ?? 0)
  const walletAmount = useBalance ? Math.min(balance, price) : 0
  const remainder = Math.max(0, +(price - walletAmount).toFixed(2))

  async function uploadReceipt(file?: File) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.set('receipt', file)
      const response = await fetch('/api/catalog/receipt', { method: 'POST', body: form })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'تعذّر رفع الإيصال')
      setReceiptUrl(result.receiptUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر رفع الإيصال')
    } finally {
      setUploading(false)
    }
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ''))
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      setError('تعذّر نسخ البيانات إلى الحافظة')
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || uploading) return
    if (remainder > 0 && (!receiptUrl || !senderName.trim())) {
      setError('أرفق صورة الإيصال واكتب اسم المحوّل لإكمال الطلب')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/catalog/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase',
          itemId: item.id,
          useBalance,
          bankKey: remainder > 0 ? bank.key : null,
          receiptUrl: remainder > 0 ? receiptUrl : null,
          senderName: remainder > 0 ? senderName.trim() : null,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'تعذّر إتمام الشراء')
      if (typeof result.ticketId !== 'string') throw new Error('تعذّر فتح تذكرة الطلب')
      onComplete(result.ticketId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'حدث خطأ غير متوقع')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="marketplace-checkout-title" className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">إتمام الشراء</p>
          <h2 id="marketplace-checkout-title" className="mt-1 text-xl font-bold">{item.name}</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="إغلاق نافذة الشراء" onClick={onCancel}><X /></Button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">قيمة المنتج</span>
            <strong>{formatSar(price)}</strong>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
            <span className="flex items-center gap-2 text-sm"><Wallet className="size-4 text-primary" /> استخدام رصيد المحفظة ({formatSar(balance)})</span>
            <input type="checkbox" checked={useBalance} onChange={(event) => setUseBalance(event.target.checked)} className="size-4 accent-primary" />
          </label>
          {walletAmount > 0 && <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">من المحفظة</span><span>- {formatSar(walletAmount)}</span></div>}
          <div className="flex justify-between gap-3 border-t border-border/60 pt-3 text-sm"><span className="font-medium">المتبقي للدفع</span><strong>{formatSar(remainder)}</strong></div>
        </div>

        {remainder > 0 && (
          <div className="flex flex-col gap-4 rounded-xl border border-border/60 p-4">
            <div className="flex items-center gap-2 font-semibold"><Landmark className="size-4 text-primary" /> تحويل بنكي</div>
            <label className="flex flex-col gap-2 text-sm">
              <span>الحساب البنكي</span>
              <select value={bank.key} onChange={(event) => setBank(BANKS.find((entry) => entry.key === event.target.value) ?? BANKS[0])} className="h-10 rounded-md border border-border/60 bg-background px-3">
                {BANKS.map((entry) => <option key={entry.key} value={entry.key}>{entry.nameAr} — {entry.name}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">اسم المستفيد</span><span className="text-left">{bank.holder}</span></div>
              <CopyRow label="رقم الحساب" value={bank.account} copied={copied === 'account'} onCopy={() => copy(bank.account, 'account')} />
              <CopyRow label="IBAN" value={bank.iban} copied={copied === 'iban'} onCopy={() => copy(bank.iban, 'iban')} />
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">المبلغ المطلوب</span><strong>{formatSar(remainder)}</strong></div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="marketplace-sender">اسم المحوّل</Label>
              <Input id="marketplace-sender" autoComplete="name" maxLength={120} value={senderName} onChange={(event) => setSenderName(event.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="marketplace-receipt">إيصال التحويل (JPG، PNG أو WEBP، حتى 5 ميغابايت)</Label>
              <label htmlFor="marketplace-receipt" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground hover:border-primary/60">
                {uploading ? <><Loader2 className="size-4 animate-spin" /> جارٍ رفع الإيصال</> : receiptUrl ? <><CheckCircle2 className="size-4 text-primary" /> تم رفع الإيصال</> : <><Upload className="size-4" /> اختر صورة الإيصال</>}
              </label>
              <input id="marketplace-receipt" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { void uploadReceipt(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
            </div>
          </div>
        )}

        {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>إلغاء</Button>
          <Button type="submit" disabled={submitting || uploading}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : remainder > 0 ? <Clock3 className="size-4" /> : <Wallet className="size-4" />}
            {remainder > 0 ? 'إرسال الطلب للمراجعة' : 'الدفع وإتمام الشراء'}
          </Button>
        </div>
      </form>
    </section>
  )
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span dir="ltr" className="truncate font-mono text-xs">{value}</span>
        <Button type="button" variant="ghost" size="icon" aria-label={`نسخ ${label}`} onClick={onCopy}><Copy /></Button>
      </span>
    </div>
  )
}
