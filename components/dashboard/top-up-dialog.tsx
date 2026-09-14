'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { randomBank, type Bank } from '@/lib/banks'
import { formatSar, formatUsd, sarToUsd } from '@/lib/currency'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check, Upload, Loader2, CheckCircle2, X, Landmark } from 'lucide-react'

export function TopUpDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [amount, setAmount] = useState<number>(50)
  const [bank] = useState<Bank>(() => randomBank())
  const [copied, setCopied] = useState<string | null>(null)
  const [senderName, setSenderName] = useState('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text.replace(/\s/g, ''))
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  async function onReceipt(file: File | undefined) {
    if (!file || !user) return
    setUploading(true)
    setError('')
    try {
      const supabase = createClient()
      const path = `${user.id}/topup-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('receipts').getPublicUrl(path)
      setReceiptUrl(data.publicUrl)
    } catch {
      setError('تعذّر رفع الإيصال.')
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!(amount > 0)) return setError('أدخل مبلغاً صحيحاً')
    if (!receiptUrl || !senderName.trim()) return setError('ارفع الإيصال وأدخل اسم المحوّل')
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/topups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountSar: amount, bankKey: bank.key, receiptUrl, senderName: senderName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'تعذّر الإرسال')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border/60 bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">شحن الرصيد</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-primary" />
            <p className="font-semibold">تم استلام طلب الشحن</p>
            <p className="mt-1 text-sm text-muted-foreground">ستؤكد الإدارة التحويل ويُضاف الرصيد قريباً.</p>
            <Button className="mt-5 w-full" onClick={onClose}>
              تمام
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topup-amount">المبلغ (SAR)</Label>
              <Input
                id="topup-amount"
                type="number"
                min={1}
                value={amount || ''}
                onChange={(e) => setAmount(Math.max(0, +e.target.value))}
              />
              <div className="flex flex-wrap gap-2">
                {[25, 50, 100, 200, 500].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className={`rounded-lg border px-3 py-1 text-sm ${
                      amount === v ? 'border-primary bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">≈ {formatUsd(sarToUsd(amount))}</p>
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Landmark className="h-4 w-4 text-primary" />
                {bank.nameAr}
              </div>
              <Row label="رقم الحساب" value={bank.account} onCopy={() => copy(bank.account, 'acc')} copied={copied === 'acc'} />
              <Row label="IBAN" value={bank.iban} onCopy={() => copy(bank.iban, 'iban')} copied={copied === 'iban'} />
              <div className="text-xs text-muted-foreground">المستفيد: {bank.holder}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topup-sender">اسم المحوّل</Label>
              <Input id="topup-sender" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>صورة الإيصال</Label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground hover:border-primary/50">
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> جارٍ الرفع…
                  </>
                ) : receiptUrl ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-primary" /> تم رفع الإيصال
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> اختر صورة الإيصال
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onReceipt(e.target.files?.[0])} />
              </label>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `إرسال طلب شحن ${formatSar(amount)}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-card/60 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-sm" dir="ltr">
          {value}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onCopy} className="shrink-0 gap-1">
        {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  )
}
