'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/mock-auth'
import { useTickets } from '@/components/tickets/tickets-provider'
import {
  DELIVERY_LABELS,
  SUPPLIERS,
  applyCoupon,
  type DeliveryType,
  type Coupon,
} from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wallet, Tag, CheckCircle2, Ticket } from 'lucide-react'

export function Checkout() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()
  const { createTicket } = useTickets()
  const [ticketId, setTicketId] = useState<string | null>(null)

  const amount = Number(params.get('amount') ?? 0)
  const delivery = (params.get('delivery') ?? 'group') as DeliveryType
  const supplierId = params.get('supplier') ?? ''
  const subtotal = Number(params.get('price') ?? 0)
  const supplier = SUPPLIERS.find((s) => s.id === supplierId)

  const [useBalance, setUseBalance] = useState(true)
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<{ coupon: Coupon; discount: number } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [done, setDone] = useState(false)

  const balance = user?.balance ?? 0

  const totals = useMemo(() => {
    const discount = coupon?.discount ?? 0
    const afterCoupon = Math.max(0, +(subtotal - discount).toFixed(2))
    const balanceUsed = useBalance ? Math.min(balance, afterCoupon) : 0
    const toPay = +(afterCoupon - balanceUsed).toFixed(2)
    return { discount, afterCoupon, balanceUsed, toPay }
  }, [subtotal, coupon, useBalance, balance])

  function checkCoupon() {
    setCouponError('')
    const res = applyCoupon(couponInput, subtotal)
    if (!res) {
      setCoupon(null)
      setCouponError('كود الخصم غير صالح')
      return
    }
    setCoupon(res)
  }

  function pay() {
    if (!supplier) return
    const ticket = createTicket({
      subject: `طلب ${amount.toLocaleString()} روبوكس`,
      buyer: user?.username ?? 'زائر',
      seller: supplier.name,
      amount,
      delivery: DELIVERY_LABELS[delivery],
      price: subtotal,
      firstMessage: {
        id: 'init',
        author: 'النظام',
        role: 'system',
        body: `تم إنشاء الطلب. الكمية ${amount.toLocaleString()} R$ عبر ${DELIVERY_LABELS[delivery]}.`,
        at: Date.now(),
      },
    })
    setTicketId(ticket.id)
    setDone(true)
  }

  if (!amount || !supplier) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
        <p className="text-muted-foreground">لا يوجد طلب. ابدأ من صفحة الشراء.</p>
        <Button className="mt-4" onClick={() => router.push('/market')}>
          اذهب للسوق
        </Button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-primary/40 bg-primary/5 p-10 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-primary" />
        <h2 className="text-2xl font-bold">تم استلام طلبك</h2>
        <p className="mt-2 text-muted-foreground">
          تم إنشاء طلبك بنجاح مع البائع <span className="text-foreground">{supplier.name}</span>. تُفتح تذكرة
          لمتابعة التسليم مع الدعم لحظة بلحظة.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => router.push(ticketId ? `/tickets/${ticketId}` : '/tickets')} className="gap-2">
            <Ticket className="h-4 w-4" />
            فتح تذكرة المتابعة
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
        {/* الرصيد */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="mb-4 text-lg font-bold">طريقة الدفع</h2>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 p-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">الدفع من الرصيد الداخلي</div>
                <div className="text-xs text-muted-foreground">رصيدك: {balance.toFixed(2)} $</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={useBalance}
              onChange={(e) => setUseBalance(e.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            يُخصم رصيدك المتاح من المبلغ، وتُكمل الباقي عبر الدفع الخارجي.
          </p>
        </div>

        {/* الكوبون */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Tag className="h-4 w-4 text-primary" />
            كوبون الخصم
          </h2>
          <div className="flex gap-2">
            <Input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="مثال: SWIFT10"
            />
            <Button variant="secondary" onClick={checkCoupon}>
              تطبيق
            </Button>
          </div>
          {couponError && <p className="mt-2 text-xs text-destructive">{couponError}</p>}
          {coupon && (
            <p className="mt-2 flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              تم تطبيق {coupon.coupon.code} — خصم {coupon.discount} $
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
            <dd className="font-medium">{supplier.name}</dd>
          </div>
          <div className="flex justify-between border-t border-border/60 pt-2.5">
            <dt className="text-muted-foreground">المجموع الفرعي</dt>
            <dd className="font-medium">{subtotal.toFixed(2)} $</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-primary">
              <dt>خصم الكوبون</dt>
              <dd>- {totals.discount.toFixed(2)} $</dd>
            </div>
          )}
          {totals.balanceUsed > 0 && (
            <div className="flex justify-between text-primary">
              <dt>من الرصيد</dt>
              <dd>- {totals.balanceUsed.toFixed(2)} $</dd>
            </div>
          )}
        </dl>
        <div className="border-t border-border/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">المطلوب دفعه</span>
            <span className="text-2xl font-bold text-primary">{totals.toPay.toFixed(2)} $</span>
          </div>
        </div>
        <Button className="w-full" size="lg" onClick={pay}>
          {totals.toPay === 0 ? 'إتمام الطلب بالرصيد' : `ادفع ${totals.toPay.toFixed(2)} $`}
        </Button>
      </aside>
    </div>
  )
}
