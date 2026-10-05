'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Ticket, Power } from 'lucide-react'

type Coupon = {
  id: string
  code: string
  kind: 'discount' | 'referral'
  percent: number
  active: boolean
  discount_type: 'percent' | 'fixed'
  fixed_amount: number
  min_order_amount: number
  max_discount: number | null
  min_robux: number | null
  max_robux: number | null
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  per_user_limit: number | null
  audience: 'all' | 'new_accounts' | 'first_order' | 'returning'
  new_account_days: number
  redeemed_count: number
}

type CouponForm = {
  code: string
  kind: 'discount' | 'referral'
  discountType: 'percent' | 'fixed'
  value: number
  minOrder: number
  targetRobux: string
  maxDiscount: string
  startsAt: string
  expiresAt: string
  usageLimit: string
  perUserLimit: string
  audience: Coupon['audience']
  newAccountDays: number
}

const initialForm: CouponForm = {
  code: '',
  kind: 'discount',
  discountType: 'percent',
  value: 10,
  minOrder: 0,
  targetRobux: '',
  maxDiscount: '',
  startsAt: '',
  expiresAt: '',
  usageLimit: '',
  perUserLimit: '',
  audience: 'all',
  newAccountDays: 30,
}

async function fetchCoupons(url: string) {
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? 'تعذّر تحميل الكوبونات')
  return body as { coupons: Coupon[] }
}

function dateLabel(value: string | null) {
  if (!value) return 'بلا حد زمني'
  return new Date(value).toLocaleDateString('ar-SA')
}

function audienceLabel(audience: Coupon['audience'], days: number) {
  if (audience === 'new_accounts') return `حسابات جديدة (آخر ${days} يوم)`
  if (audience === 'first_order') return 'أول طلب'
  if (audience === 'returning') return 'العملاء العائدون'
  return 'جميع العملاء'
}

export function CouponManager() {
  const { data, error: loadError, isLoading, mutate } = useSWR('/api/admin/coupons', fetchCoupons)
  const [form, setForm] = useState<CouponForm>(initialForm)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const coupons = data?.coupons ?? []

  function update<K extends keyof CouponForm>(key: K, value: CouponForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function create() {
    setError('')
    if (form.discountType === 'percent' && (form.value <= 0 || form.value > 100)) {
      setError('النسبة يجب أن تكون بين 1 و100.')
      return
    }
    if (form.discountType === 'fixed' && form.value <= 0) {
      setError('أدخل مبلغ خصم أكبر من صفر.')
      return
    }
    if (form.targetRobux && (!Number.isSafeInteger(Number(form.targetRobux)) || Number(form.targetRobux) <= 0)) {
      setError('أدخل كمية روبكس صحيحة أكبر من صفر.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          kind: form.kind,
          discount_type: form.discountType,
          value: form.value,
          min_order_amount: form.minOrder,
          min_robux: form.targetRobux || null,
          max_robux: form.targetRobux || null,
          max_discount: form.maxDiscount || null,
          starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          usage_limit: form.usageLimit || null,
          per_user_limit: form.perUserLimit || null,
          audience: form.audience,
          new_account_days: form.audience === 'new_accounts' ? form.newAccountDays : null,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'تعذّر إنشاء الكوبون')
      setForm(initialForm)
      await mutate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر إنشاء الكوبون')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(coupon: Coupon) {
    setError('')
    setBusyId(coupon.id)
    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, active: !coupon.active }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'تعذّر تحديث الكوبون')
      await mutate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر تحديث الكوبون')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(coupon: Coupon) {
    if (!window.confirm(`هل تريد حذف الكوبون ${coupon.code}؟`)) return
    setError('')
    setBusyId(coupon.id)
    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'تعذّر حذف الكوبون')
      await mutate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر حذف الكوبون')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)]">
      <section className="h-fit rounded-xl border border-border/60 bg-card/40 p-5">
        <h2 className="mb-5 flex items-center gap-2 text-sm font-bold">
          <Plus className="size-4 text-primary" /> إنشاء كوبون / رمز إحالة
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="coupon-code">الرمز</Label>
            <Input id="coupon-code" value={form.code} onChange={(event) => update('code', event.target.value)} placeholder="مثال: SWIFT10" autoComplete="off" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coupon-kind">نوع الرمز</Label>
            <select id="coupon-kind" value={form.kind} onChange={(event) => update('kind', event.target.value as CouponForm['kind'])} className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm">
              <option value="discount">خصم</option>
              <option value="referral">إحالة</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coupon-audience">المستفيدون</Label>
            <select id="coupon-audience" value={form.audience} onChange={(event) => update('audience', event.target.value as CouponForm['audience'])} className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm">
              <option value="all">جميع العملاء</option>
              <option value="new_accounts">الحسابات الجديدة</option>
              <option value="first_order">الطلب الأول</option>
              <option value="returning">العملاء العائدون</option>
            </select>
          </div>

          {form.audience === 'new_accounts' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-account-days">عمر الحساب (بالأيام)</Label>
              <Input id="new-account-days" type="number" min="1" max="3650" value={form.newAccountDays} onChange={(event) => update('newAccountDays', Number(event.target.value))} />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discount-type">طريقة الخصم</Label>
            <select id="discount-type" value={form.discountType} onChange={(event) => update('discountType', event.target.value as CouponForm['discountType'])} className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm">
              <option value="percent">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت (ر.س)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discount-value">{form.discountType === 'percent' ? 'نسبة الخصم (%)' : 'قيمة الخصم (ر.س)'}</Label>
            <Input id="discount-value" type="number" min="0.01" max={form.discountType === 'percent' ? 100 : undefined} step="0.01" value={form.value} onChange={(event) => update('value', Number(event.target.value))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min-order">الحد الأدنى للطلب (ر.س)</Label>
            <Input id="min-order" type="number" min="0" step="0.01" value={form.minOrder} onChange={(event) => update('minOrder', Number(event.target.value))} />
          </div>
          {form.discountType === 'percent' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max-discount">أقصى خصم (اختياري، ر.س)</Label>
              <Input id="max-discount" type="number" min="0.01" step="0.01" value={form.maxDiscount} onChange={(event) => update('maxDiscount', event.target.value)} placeholder="بلا سقف" />
            </div>
          )}

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="target-robux">كمية الروبكس المطلوبة للخصم (اختياري، R$)</Label>
            <Input id="target-robux" type="number" min="1" step="1" value={form.targetRobux} onChange={(event) => update('targetRobux', event.target.value)} placeholder="مثال: 31000 — يطبق الخصم على هذه الكمية فقط" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coupon-start">يبدأ في (اختياري)</Label>
            <Input id="coupon-start" type="datetime-local" value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coupon-expiry">ينتهي في (اختياري)</Label>
            <Input id="coupon-expiry" type="datetime-local" value={form.expiresAt} onChange={(event) => update('expiresAt', event.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="usage-limit">إجمالي مرات الاستخدام (اختياري)</Label>
            <Input id="usage-limit" type="number" min="1" step="1" value={form.usageLimit} onChange={(event) => update('usageLimit', event.target.value)} placeholder="بلا حد" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="per-user-limit">مرات الاستخدام لكل عميل (اختياري)</Label>
            <Input id="per-user-limit" type="number" min="1" step="1" value={form.perUserLimit} onChange={(event) => update('perUserLimit', event.target.value)} placeholder="بلا حد" />
          </div>
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        {loadError && <p role="alert" className="mt-4 text-sm text-destructive">{loadError.message}</p>}
        <Button onClick={create} disabled={saving} className="mt-5 w-full gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} إنشاء الكوبون
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Ticket className="size-4 text-primary" /> الكوبونات الحالية ({coupons.length})
        </h2>
        {isLoading ? (
          <div role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
          </div>
        ) : coupons.length === 0 ? (
          <p className="rounded-xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">لا توجد كوبونات بعد.</p>
        ) : (
          coupons.map((coupon) => (
            <article key={coupon.id} className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{coupon.code}</h3>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{coupon.discount_type === 'percent' ? `${coupon.percent}%` : `${coupon.fixed_amount} ر.س`}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${coupon.active ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                    {coupon.active ? 'مفعّل' : 'معطّل'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {coupon.kind === 'referral' ? 'إحالة' : 'خصم'} · {audienceLabel(coupon.audience, coupon.new_account_days)} · استُخدم {coupon.redeemed_count}{coupon.usage_limit ? ` من ${coupon.usage_limit}` : ''} مرة
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  الحد الأدنى {coupon.min_order_amount} ر.س · {coupon.max_discount ? `السقف ${coupon.max_discount} ر.س · ` : ''}{dateLabel(coupon.starts_at)} — {dateLabel(coupon.expires_at)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {coupon.min_robux && coupon.max_robux && coupon.min_robux === coupon.max_robux
                    ? `كمية الروبكس المطلوبة: ${coupon.min_robux.toLocaleString('en-US')} R$`
                    : `كمية الروبكس: ${coupon.min_robux ? `من ${coupon.min_robux.toLocaleString('en-US')} R$` : 'بلا حد أدنى'} · ${coupon.max_robux ? `إلى ${coupon.max_robux.toLocaleString('en-US')} R$` : 'بلا حد أعلى'}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => void toggle(coupon)} disabled={busyId === coupon.id} className="gap-1">
                  {busyId === coupon.id ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}{coupon.active ? 'تعطيل' : 'تفعيل'}
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => void remove(coupon)} disabled={busyId === coupon.id} aria-label={`حذف الكوبون ${coupon.code}`} className="text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
