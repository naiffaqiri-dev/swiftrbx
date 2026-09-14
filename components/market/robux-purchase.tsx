'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DELIVERY_LABELS,
  DELIVERY_NOTES,
  matchOffers,
  type ActiveOffer,
  type DeliveryType,
} from '@/lib/mock-data'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Star, Package, Truck, Zap, CheckCircle2 } from 'lucide-react'

export function RobuxPurchase() {
  const router = useRouter()
  const [amount, setAmount] = useState<number>(5000)
  const [delivery, setDelivery] = useState<DeliveryType>('group')
  const [selected, setSelected] = useState<string | null>(null)
  const [offers, setOffers] = useState<ActiveOffer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.rpc('active_offers').then(({ data }) => {
      if (!active) return
      setOffers((data ?? []) as ActiveOffer[])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const matched = useMemo(() => matchOffers(offers, amount, delivery), [offers, amount, delivery])
  const chosen = matched.find((s) => s.id === selected) ?? matched[0] ?? null

  function proceed() {
    if (!chosen) return
    const params = new URLSearchParams({
      amount: String(amount),
      delivery,
      offer: chosen.id,
      seller: chosen.username,
      price: String(chosen.price),
    })
    router.push(`/checkout?${params.toString()}`)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* الإعدادات + الموردون */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="mb-4 text-lg font-bold">حدّد طلبك</h2>

          <div className="space-y-2">
            <Label htmlFor="amount">كمية الروبوكس (R$)</Label>
            <Input
              id="amount"
              type="number"
              min={100}
              step={100}
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, +e.target.value))}
              className="text-lg"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {[1000, 5000, 10000, 20000, 50000].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    amount === v
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/60 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Label>نوع التسليم</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(DELIVERY_LABELS) as DeliveryType[]).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDelivery(d)
                    setSelected(null)
                  }}
                  className={`rounded-xl border p-3 text-right transition-colors ${
                    delivery === d
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {d === 'group' ? <Truck className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-primary" />}
                    {DELIVERY_LABELS[d]}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{DELIVERY_NOTES[d]}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">البائعون المتاحون</h2>
            <span className="text-sm text-muted-foreground">{matched.length} بائع مطابق</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ تحميل البائعين…
            </div>
          ) : matched.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
              لا يوجد بائع يطابق هذه الكمية ونوع التسليم حالياً. جرّب كمية مختلفة.
            </p>
          ) : (
            matched.map((s) => {
              const isSel = chosen?.id === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-right transition-colors ${
                    isSel ? 'border-primary bg-primary/10' : 'border-border/60 bg-card/40 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {s.username.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 font-medium">
                        {s.username}
                        {isSel && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-primary text-primary" />
                          {Number(s.rating).toFixed(1)}
                        </span>
                        <span>({s.rating_count} تقييم)</span>
                        <span className="flex items-center gap-0.5">
                          <Package className="h-3 w-3" />
                          {Number(s.available).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold text-primary">{s.price} $</div>
                    <div className="text-xs text-muted-foreground">لـ {amount.toLocaleString()} R$</div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ملخص الطلب */}
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
            <dd className="font-medium">{chosen?.username ?? '—'}</dd>
          </div>
        </dl>
        <div className="border-t border-border/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">الإجمالي</span>
            <span className="text-2xl font-bold text-primary">{chosen?.price ?? 0} $</span>
          </div>
        </div>
        <Button className="w-full" size="lg" disabled={!chosen} onClick={proceed}>
          المتابعة للدفع
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          تُفتح تذكرة تلقائياً بعد الدفع لمتابعة التسليم مع الدعم.
        </p>
      </aside>
    </div>
  )
}
