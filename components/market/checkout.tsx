'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/mock-auth'
import { DELIVERY_LABELS, applyCoupon, type DeliveryType, type Coupon } from '@/lib/mock-data'
import { randomBank, type Bank } from '@/lib/banks'
import { formatSar, formatUsd, sarToUsd } from '@/lib/currency'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Wallet,
  Tag,
  CheckCircle2,
  Ticket,
  Landmark,
  Copy,
  Check,
  Upload,
  Loader2,
  Clock,
} from 'lucide-react'

type PayMethod = 'balance' | 'bank_transfer'

export function Checkout() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, refresh } = useAuth()

  const amount = Number(params.get('amount') ?? 0)
  const delivery = (params.get('delivery') ?? 'group') as DeliveryType
  const offerId = params.get('offer') ?? ''
  const sellerName = params.get('seller') ?? ''
  const subtotal = Number(params.get('price') ?? 0)

  const [robloxUsername, setRobloxUsername] = useState('')
  const [method, setMethod] = useState<PayMethod>('balance')
  const [useBalance, setUseBalance] = useState(true)
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<{ coupon: Coupon; discount: number } | null>(null)
  const [couponError, setCouponError] = useState('')

  const [bank] = useState<Bank>(() => randomBank())
  const [copied, setCopied] = useState<string | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [senderName, setSenderName] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ orderId: string; ticketId: string | null; status: string } | null>(null)

  const balance = user?.balance ?? 0

  const totals = useMemo(() => {
    const discount = coupon?.discount ?? 0
    const afterCoupon = Math.max(0, +(subtotal - discount).toFixed(2))
    const balanceUsed = useBalance ? Math.min(balance, afterCoupon) : 0
    const toPay = +(afterCoupon - balanceUsed).toFixed(2)
    return { discount, afterCoupon, balanceUsed, toPay }
  }, [subtotal, coupon, useBalance, balance])

  const needsBank = totals.toPay > 0

  function checkCoupon() {
    setCouponError('')
    const res = applyCoupon(couponInput, subtotal)
    if (!res) {
      setCoupon(null)
      setCouponError('كود الخصم أو الإحالة غير صالح')
      return
    }
    setCoupon(res)
  }

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
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('receipts').getPublicUrl(path)
      setReceiptUrl(data.publicUrl)
    } catch {
      setError('تعذّر رفع الإيصال، حاول مرة أخرى.')
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!offerId || !amount) return
    if (!robloxUsername.trim()) {
      setError('اسم المستخدم في روبلوكس مطلوب قبل المتابعة.')
      return
    }
    if (needsBank && (method !== 'bank_transfer')) {
      setError('اختر التحويل البنكي لإكمال المبلغ المتبقي.')
      return
    }
    if (needsBank && (!receiptUrl || !senderName.trim())) {
      setError('ارفع صورة الإيصال وأدخل اسم المحوّل.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          amount,
          delivery,
          robloxUsername: robloxUsername.trim(),
          useBalance,
          couponCode: coupon?.coupon.code ?? null,
          paymentMethod: needsBank ? 'bank_transfer' : 'balance',
          bankKey: needsBank ? bank.key : null,
          receiptUrl: needsBank ? receiptUrl : null,
          senderName: needsBank ? senderName.trim() : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'تعذّر إنشاء الطلب')
      await refresh?.()
      setResult({ orderId: json.orderId, ticketId: json.ticketId, status: json.status })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setSubmitting(false)
    }
  }

  if (!amount || !offerId) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
        <p className="text-muted-foreground">لا يوجد طلب. ابدأ من صفحة الشراء.</p>
        <Button className="mt-4" onClick={() => router.push('/market')}>
          اذهب للسوق
        </Button>
      </div>
    )
  }

  if (result) {
    const paid = result.status === 'processing'
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-primary/40 bg-primary/5 p-10 text-center">
        {paid ? (
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-primary" />
        ) : (
          <Clock className="mx-auto mb-4 h-14 w-14 text-primary" />
        )}
        <h2 className="text-2xl font-bold">{paid ? 'تم استلام طلبك' : 'جارٍ تأكيد الدفع'}</h2>
        <p className="mt-2 text-muted-foreground">
          {paid
            ? 'تم الدفع من رصيدك وبدأ تنفيذ الطلب.'
            : 'استلمنا إيصالك، وستراجعه الإدارة وتؤكد المبلغ قريباً. تتبّع الحالة من تذكرة الطلب.'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">رقم الطلب: {result.orderId.slice(0, 8)}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => router.push('/dashboard')} className="gap-2">
            <Ticket className="h-4 w-4" />
            متابعة الطلب من لوحتي
          </Button>
          <Button variant="secondary" onClick={() => router.push('/market')}>
            طلب جديد
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {/* اسم المستخدم في روبلوكس */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="mb-4 text-lg font-bold">بيانات التسليم</h2>
          <div className="space-y-2">
            <Label htmlFor="roblox">
              اسم المستخدم في روبلوكس <span className="text-destructive">*</span>
            </Label>
            <Input
              id="roblox"
              value={robloxUsername}
              onChange={(e) => setRobloxUsername(e.target.value)}
              placeholder="Roblox Username"
              required
            />
            <p className="text-xs text-muted-foreground">
              يُستخدم لتسليم الروبوكس عبر {DELIVERY_LABELS[delivery]}. لا يمكن المتابعة بدونه.
            </p>
          </div>
        </div>

        {/* طريقة الدفع */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="mb-4 text-lg font-bold">طريقة الدفع</h2>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 p-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">الدفع من الرصيد الداخلي</div>
                <div className="text-xs text-muted-foreground">رصيدك: {formatSar(balance)}</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={useBalance}
              onChange={(e) => setUseBalance(e.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>

          {needsBank && (
            <div className="mt-4 space-y-4">
              <button
                onClick={() => setMethod('bank_transfer')}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-right transition-colors ${
                  method === 'bank_transfer' ? 'border-primary bg-primary/10' : 'border-border/60'
                }`}
              >
                <Landmark className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">تحويل بنكي</div>
                  <div className="text-xs text-muted-foreground">أكمل المتبقي {formatSar(totals.toPay)}</div>
                </div>
              </button>

              {method === 'bank_transfer' && (
                <div className="space-y-4 rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{bank.nameAr}</span>
                    <span className="text-xs text-muted-foreground">{bank.name}</span>
                  </div>
                  <BankRow label="رقم الحساب" value={bank.account} onCopy={() => copy(bank.account, 'acc')} copied={copied === 'acc'} />
                  <BankRow label="IBAN" value={bank.iban} onCopy={() => copy(bank.iban, 'iban')} copied={copied === 'iban'} />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">اسم المستفيد</div>
                      <div className="font-medium">{bank.holder}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">سبب التحويل</div>
                      <div className="font-medium">{bank.reason}</div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <Label htmlFor="sender">اسم المحوّل</Label>
                    <Input id="sender" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="الاسم كما في الحوالة" />
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
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onReceipt(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* كوبون / إحالة موحّد */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Tag className="h-4 w-4 text-primary" />
            كود الخصم أو الإحالة
          </h2>
          <div className="flex gap-2">
            <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="أدخل الكود" />
            <Button variant="secondary" onClick={checkCoupon}>
              تطبيق
            </Button>
          </div>
          {couponError && <p className="mt-2 text-xs text-destructive">{couponError}</p>}
          {coupon && (
            <p className="mt-2 flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              تم تطبيق {coupon.coupon.code} — خصم {formatSar(coupon.discount)}
            </p>
          )}
        </div>
      </div>

      {/* الملخص */}
      <aside className="h-fit space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold">ملخص الطلب</h2>
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">الكمية</dt>
            <dd className="font-medium">{amount.toLocaleString()} R$</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">التسليم</dt>
            <dd className="font-medium">{DELIVERY_LABELS[delivery]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">البائع</dt>
            <dd className="font-medium">{sellerName || '—'}</dd>
          </div>
          <div className="flex justify-between border-t border-border/60 pt-2.5">
            <dt className="text-muted-foreground">المجموع الفرعي</dt>
            <dd className="font-medium">{formatSar(subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-primary">
              <dt>الخصم</dt>
              <dd>- {formatSar(totals.discount)}</dd>
            </div>
          )}
          {totals.balanceUsed > 0 && (
            <div className="flex justify-between text-primary">
              <dt>من الرصيد</dt>
              <dd>- {formatSar(totals.balanceUsed)}</dd>
            </div>
          )}
        </dl>
        <div className="border-t border-border/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">المطلوب دفعه</span>
            <div className="text-left">
              <div className="text-2xl font-bold text-primary">{formatSar(totals.toPay)}</div>
              <div className="text-xs text-muted-foreground">≈ {formatUsd(sarToUsd(totals.toPay))}</div>
            </div>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button className="w-full" size="lg" onClick={submit} disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : totals.toPay === 0 ? (
            'إتمام الطلب بالرصيد'
          ) : (
            `تأكيد الطلب (${formatSar(totals.toPay)})`
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          تُفتح تذكرة تلقائياً لمتابعة التسليم مع الدعم والبائع.
        </p>
      </aside>
    </div>
  )
}

function BankRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string
  value: string
  onCopy: () => void
  copied: boolean
}) {
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
        {copied ? 'تم' : 'نسخ'}
      </Button>
    </div>
  )
}
