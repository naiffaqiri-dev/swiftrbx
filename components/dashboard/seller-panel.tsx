'use client'

import { useEffect, useState } from 'react'
import { useAuth, ratingOf } from '@/components/auth/mock-auth'
import { createClient } from '@/lib/supabase/client'
import { DashboardShell, StatCard } from './dashboard-shell'
import { StarDisplay } from '@/components/reviews/star-rating'
import { DELIVERY_LABELS, type DeliveryType } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LayoutDashboard, Package, Wallet, CheckCircle2, Star, Percent, Loader2, CheckCircle } from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'stock', label: 'عرض البيع', icon: <Package className="h-4 w-4" /> },
  { key: 'wallet', label: 'المحفظة والعمولة', icon: <Wallet className="h-4 w-4" /> },
]

type OfferForm = {
  available: number
  min: number
  max: number
  rate: number
  delivery: DeliveryType[]
  active: boolean
}

const DEFAULT_OFFER: OfferForm = {
  available: 0,
  min: 1000,
  max: 20000,
  rate: 4.2,
  delivery: ['group'],
  active: true,
}

export function SellerPanel() {
  const { user } = useAuth()
  const [active, setActive] = useState('overview')
  const [offer, setOffer] = useState<OfferForm>(DEFAULT_OFFER)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const rating = ratingOf(user)

  useEffect(() => {
    if (!user) return
    let alive = true
    const supabase = createClient()
    supabase
      .from('offers')
      .select('available, min_amount, max_amount, rate, delivery, active')
      .eq('seller_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        if (data) {
          setOffer({
            available: Number(data.available),
            min: Number(data.min_amount),
            max: Number(data.max_amount),
            rate: Number(data.rate),
            delivery: (data.delivery ?? ['group']) as DeliveryType[],
            active: !!data.active,
          })
        }
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [user])

  function toggleDelivery(d: DeliveryType) {
    setOffer((o) => {
      const has = o.delivery.includes(d)
      const next = has ? o.delivery.filter((x) => x !== d) : [...o.delivery, d]
      return { ...o, delivery: next.length ? next : o.delivery }
    })
  }

  async function saveOffer() {
    if (!user) return
    setError('')
    if (offer.rate <= 0) {
      setError('حدّد سعراً صحيحاً لكل 1000 روبوكس')
      return
    }
    if (offer.min <= 0 || offer.max < offer.min) {
      setError('تحقق من الحد الأدنى والأقصى')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('offers').upsert(
      {
        seller_id: user.id,
        available: offer.available,
        min_amount: offer.min,
        max_amount: offer.max,
        rate: offer.rate,
        delivery: offer.delivery,
        active: offer.active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'seller_id' },
    )
    setSaving(false)
    if (err) {
      setError('تعذّر حفظ العرض، حاول مرة أخرى')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <DashboardShell title="لوحة المورد" nav={NAV} active={active} onNavigate={setActive}>
      {active === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="الرصيد الحالي" value={`${(user?.balance ?? 0).toLocaleString()} $`} accent icon={<Wallet className="h-5 w-5" />} />
            <StatCard label="عمليات ناجحة" value={user?.totalSales ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="العمولة المستحقة" value={`${(user?.commission ?? 0).toLocaleString()} $`} icon={<Percent className="h-5 w-5" />} />
            <StatCard label="روبوكس متاح" value={offer.available.toLocaleString()} icon={<Package className="h-5 w-5" />} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Star className="h-4 w-4 text-primary" />
              تقييمك كمورد
            </h2>
            <div className="flex items-center gap-3">
              <StarDisplay value={rating.avg} size={22} />
              <span className="text-lg font-bold">{rating.avg || '—'}</span>
              <span className="text-sm text-muted-foreground">({rating.count} تقييم)</span>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-5 text-sm text-muted-foreground">
            حالة عرضك:{' '}
            {offer.active && offer.rate > 0 && offer.available > 0 ? (
              <span className="font-medium text-primary">ظاهر للمشترين في السوق</span>
            ) : (
              <span className="font-medium text-destructive">غير ظاهر — فعّل العرض وحدّد سعراً وكمية</span>
            )}
          </div>
        </div>
      )}

      {active === 'stock' && (
        <div className="max-w-md space-y-4 rounded-xl border border-border/60 bg-card/40 p-5">
          <h2 className="text-sm font-bold">عرض البيع الخاص بك</h2>
          <p className="text-xs text-muted-foreground">
            يفرز الموقع البائعين تلقائياً حسب هذه القيم عند طلب المشتري لكمية معينة. لا يظهر عرضك إلا عند تفعيله وتحديد سعر وكمية.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ تحميل عرضك…
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="av">الكمية المتاحة (R$)</Label>
                <Input id="av" type="number" value={offer.available} onChange={(e) => setOffer((s) => ({ ...s, available: +e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate">السعر لكل 1000 روبوكس ($)</Label>
                <Input id="rate" type="number" step="0.1" value={offer.rate} onChange={(e) => setOffer((s) => ({ ...s, rate: +e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mn">الحد الأدنى</Label>
                  <Input id="mn" type="number" value={offer.min} onChange={(e) => setOffer((s) => ({ ...s, min: +e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mx">الحد الأقصى</Label>
                  <Input id="mx" type="number" value={offer.max} onChange={(e) => setOffer((s) => ({ ...s, max: +e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>طرق التسليم المدعومة</Label>
                <div className="grid gap-2">
                  {(Object.keys(DELIVERY_LABELS) as DeliveryType[]).map((d) => (
                    <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={offer.delivery.includes(d)}
                        onChange={() => toggleDelivery(d)}
                        className="h-4 w-4 accent-primary"
                      />
                      {DELIVERY_LABELS[d]}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 p-2.5 text-sm">
                <span>تفعيل العرض (ظاهر في السوق)</span>
                <input
                  type="checkbox"
                  checked={offer.active}
                  onChange={(e) => setOffer((s) => ({ ...s, active: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
              </label>

              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full gap-2" onClick={saveOffer} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : null}
                {saved ? 'تم الحفظ' : 'حفظ العرض'}
              </Button>
            </>
          )}
        </div>
      )}

      {active === 'wallet' && (
        <div className="max-w-md space-y-4 rounded-xl border border-border/60 bg-card/40 p-5">
          <div className="text-sm text-muted-foreground">الرصيد المتاح للسحب</div>
          <div className="text-3xl font-bold text-primary">{(user?.balance ?? 0).toLocaleString()} $</div>
          <Button className="w-full">طلب سحب الأموال</Button>
          <p className="text-xs text-muted-foreground">
            يفتح زر السحب تذكرة خاصة بينك وبين الإدارة العليا لتأكيد الإرسال.
          </p>
        </div>
      )}
    </DashboardShell>
  )
}
