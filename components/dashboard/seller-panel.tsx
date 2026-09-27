'use client'

import { useEffect, useState } from 'react'
import { useAuth, ratingOf } from '@/components/auth/mock-auth'
import { createClient } from '@/lib/supabase/client'
import { DashboardShell, StatCard } from './dashboard-shell'
import { MarketplaceAvailabilitySummary } from '@/components/market/marketplace-availability'
import { TicketsList } from './tickets-list'
import { StarDisplay } from '@/components/reviews/star-rating'
import { DELIVERY_TYPES, DELIVERY_LABELS, DELIVERY_NOTES, GAMEPASS_GUIDE_URL, isHttpsLink, isRobloxGroupLink, type DeliveryType } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LayoutDashboard, Package, Wallet, CheckCircle2, Star, Percent, Loader2, CheckCircle, Ticket, ExternalLink } from 'lucide-react'
import { formatMoney } from '@/lib/currency'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'orders', label: 'التذاكر النشطة', icon: <Ticket className="h-4 w-4" /> },
  { key: 'stock', label: 'عرض البيع', icon: <Package className="h-4 w-4" /> },
  { key: 'wallet', label: 'المحفظة والعمولة', icon: <Wallet className="h-4 w-4" /> },
]

// عرض مستقل لكل نوع تسليم: كمية وسعر وحدود خاصة به
type TypeOffer = {
  available: number
  min: number
  max: number
  rate: number
  active: boolean
}

function defaultTypeOffer(): TypeOffer {
  return { available: 0, min: 1000, max: 20000, rate: 4.2, active: false }
}

type OffersState = Record<DeliveryType, TypeOffer>

function emptyOffers(): OffersState {
  return DELIVERY_TYPES.reduce((acc, d) => {
    acc[d] = defaultTypeOffer()
    return acc
  }, {} as OffersState)
}

export function SellerPanel() {
  const { user } = useAuth()
  const [active, setActive] = useState('overview')
  const [offers, setOffers] = useState<OffersState>(emptyOffers)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [groupLinks, setGroupLinks] = useState('')
  const [savingGroupLinks, setSavingGroupLinks] = useState(false)
  const [groupLinksSaved, setGroupLinksSaved] = useState(false)
  const [groupLinksError, setGroupLinksError] = useState('')
  const [gamepassLinks, setGamepassLinks] = useState('')
  const [savingGamepassLinks, setSavingGamepassLinks] = useState(false)
  const [gamepassLinksSaved, setGamepassLinksSaved] = useState(false)
  const [gamepassLinksError, setGamepassLinksError] = useState('')
  const rating = ratingOf(user)

  useEffect(() => {
    if (!user) return
    let alive = true
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('group_links, gamepass_links')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setGroupLinks(Array.isArray(data?.group_links) ? data.group_links.join('\n') : '')
        setGamepassLinks(Array.isArray(data?.gamepass_links) ? data.gamepass_links.join('\n') : '')
      })
    supabase
      .from('offers')
      .select('available, min_amount, max_amount, rate, delivery, delivery_type, active')
      .eq('seller_id', user.id)
      .then(({ data }) => {
        if (!alive) return
        const next = emptyOffers()
        for (const row of data ?? []) {
          const dt = (row.delivery_type ?? (Array.isArray(row.delivery) ? row.delivery[0] : null)) as DeliveryType | null
          if (!dt || !next[dt]) continue
          next[dt] = {
            available: Number(row.available),
            min: Number(row.min_amount),
            max: Number(row.max_amount),
            rate: Number(row.rate),
            active: !!row.active,
          }
        }
        setOffers(next)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [user])

  function patchType(d: DeliveryType, patch: Partial<TypeOffer>) {
    setOffers((o) => ({ ...o, [d]: { ...o[d], ...patch } }))
  }

  async function saveOffers() {
    if (!user) return
    setError('')
    // تحقق من الأنواع المفعّلة فقط
    for (const d of DELIVERY_TYPES) {
      const t = offers[d]
      if (!t.active) continue
      if (t.rate <= 0) {
        setError(`حدّد سعراً صحيحاً لـ «${DELIVERY_LABELS[d]}»`)
        return
      }
      if (t.min <= 0 || t.max < t.min) {
        setError(`تحقق من الحد الأدنى والأقصى لـ «${DELIVERY_LABELS[d]}»`)
        return
      }
    }

    setSaving(true)
    const supabase = createClient()
    const now = new Date().toISOString()
    const rows = DELIVERY_TYPES.map((d) => ({
      seller_id: user.id,
      delivery_type: d,
      delivery: [d],
      available: offers[d].available,
      min_amount: offers[d].min,
      max_amount: offers[d].max,
      rate: offers[d].rate,
      active: offers[d].active,
      updated_at: now,
    }))
    const { error: err } = await supabase.from('offers').upsert(rows, { onConflict: 'seller_id,delivery_type' })
    setSaving(false)
    if (err) {
      setError('تعذّر حفظ العرض، حاول مرة أخرى')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function saveGroupLinks() {
    if (!user) return
    setGroupLinksError('')
    const links = [...new Set(groupLinks.split(/\r?\n/).map((link) => link.trim()).filter(Boolean))]
    if (links.length > 10) {
      setGroupLinksError('يمكنك إضافة 10 روابط كحد أقصى')
      return
    }
    const validLinks = links.every(isRobloxGroupLink)
    if (!validLinks) {
      setGroupLinksError('أدخل روابط Roblox صحيحة تبدأ بـ https://، رابطاً واحداً في كل سطر')
      return
    }

    setSavingGroupLinks(true)
    const { error: updateError } = await createClient()
      .from('profiles')
      .update({ group_links: links })
      .eq('id', user.id)
    setSavingGroupLinks(false)
    if (updateError) {
      setGroupLinksError('تعذّر حفظ روابط المجموعات، حاول مرة أخرى')
      return
    }
    setGroupLinks(links.join('\n'))
    setGroupLinksSaved(true)
    setTimeout(() => setGroupLinksSaved(false), 2500)
  }

  async function saveGamepassLinks() {
    if (!user) return
    setGamepassLinksError('')
    const links = [...new Set(gamepassLinks.split(/\r?\n/).map((link) => link.trim()).filter(Boolean))]
    if (links.length > 10) {
      setGamepassLinksError('يمكنك إضافة 10 روابط كحد أقصى')
      return
    }
    const validLinks = links.every(isHttpsLink)
    if (!validLinks) {
      setGamepassLinksError('أدخل روابط شرح صحيحة تبدأ بـ https://، رابطاً واحداً في كل سطر')
      return
    }

    setSavingGamepassLinks(true)
    const { error: updateError } = await createClient()
      .from('profiles')
      .update({ gamepass_links: links })
      .eq('id', user.id)
    setSavingGamepassLinks(false)
    if (updateError) {
      setGamepassLinksError('تعذّر حفظ روابط شرح Gamepass، حاول مرة أخرى')
      return
    }
    setGamepassLinks(links.join('\n'))
    setGamepassLinksSaved(true)
    setTimeout(() => setGamepassLinksSaved(false), 2500)
  }

  const totalAvailable = DELIVERY_TYPES.reduce((sum, d) => sum + (offers[d].active ? offers[d].available : 0), 0)
  const anyVisible = DELIVERY_TYPES.some((d) => offers[d].active && offers[d].rate > 0 && offers[d].available > 0)

  return (
    <DashboardShell title="لوحة المورد" nav={NAV} active={active} onNavigate={setActive}>
      {active === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="الرصيد الحالي" value={formatMoney(user?.balance ?? 0)} accent icon={<Wallet className="h-5 w-5" />} />
            <StatCard label="عمليات ناجحة" value={user?.totalSales ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="العمولة المستحقة" value={formatMoney(user?.commission ?? 0)} icon={<Percent className="h-5 w-5" />} />
            <StatCard label="إجمالي روبوكس متاح" value={totalAvailable.toLocaleString('en-US')} icon={<Package className="h-5 w-5" />} />
          </div>
          <MarketplaceAvailabilitySummary />
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
            {anyVisible ? (
              <span className="font-medium text-primary">ظاهر للمشترين في السوق</span>
            ) : (
              <span className="font-medium text-destructive">غير ظاهر — فعّل نوع تسليم واحداً على الأقل بسعر وكمية</span>
            )}
          </div>
        </div>
      )}

      {active === 'orders' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
            تظهر هنا تذاكر الطلبات بعد أن يختارك المشتري ويؤكد الإدارة تحويله. تواصل مع المشتري ثم اضغط «تأكيد التسليم».
          </div>
          <TicketsList role="seller" />
        </div>
      )}

      {active === 'stock' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h2 className="text-sm font-bold">عروض البيع حسب نوع التسليم</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              لكل نوع تسليم كمية وسعر وحدود مستقلة. مثال: فعّل «تحويل بلس» بكمية 7000 و«المجموعة» بكمية 7000 بسعرين مختلفين.
              لا يظهر النوع في السوق إلا عند تفعيله وتحديد سعر وكمية.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-5">
            <div>
              <h3 className="text-sm font-bold">روابط قروباتك</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                أضف روابط دعوة مجموعات Roblox الخاصة بك، رابطاً واحداً في كل سطر. ستظهر للمشتري بجانب اسمك عند اختيار تسليم المجموعة.
              </p>
            </div>
            <Label htmlFor="seller-group-links">روابط المجموعات</Label>
            <Textarea
              id="seller-group-links"
              value={groupLinks}
              onChange={(event) => setGroupLinks(event.target.value)}
              placeholder="https://www.roblox.com/share?code=..."
              dir="ltr"
              rows={3}
              aria-describedby="seller-group-links-help"
            />
            <p id="seller-group-links-help" className="text-xs text-muted-foreground">
              الروابط المقبولة آمنة وتابعة لنطاق Roblox.
            </p>
            {groupLinksError && <p className="text-xs text-destructive" role="alert">{groupLinksError}</p>}
            <Button variant="secondary" onClick={saveGroupLinks} disabled={savingGroupLinks}>
              {savingGroupLinks ? <Loader2 className="h-4 w-4 animate-spin" /> : groupLinksSaved ? <CheckCircle className="h-4 w-4" /> : null}
              {groupLinksSaved ? 'تم حفظ الروابط' : 'حفظ روابط القروبات'}
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-5">
            <div>
              <h3 className="text-sm font-bold">روابط شرح Gamepass</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                أضف رابط مقطع الشرح الخاص بك، رابطاً واحداً في كل سطر. سيظهر للمشتري بجانب اسمك عند اختيار تسليم Gamepass.
              </p>
            </div>
            <Label htmlFor="seller-gamepass-links">روابط الشرح</Label>
            <Textarea
              id="seller-gamepass-links"
              value={gamepassLinks}
              onChange={(event) => setGamepassLinks(event.target.value)}
              placeholder="https://youtu.be/..."
              dir="ltr"
              rows={3}
              aria-describedby="seller-gamepass-links-help"
            />
            <p id="seller-gamepass-links-help" className="text-xs text-muted-foreground">
              أضف رابطاً آمناً يبدأ بـ https://، وبحد أقصى 10 روابط.
            </p>
            {gamepassLinksError && <p className="text-xs text-destructive" role="alert">{gamepassLinksError}</p>}
            <Button variant="secondary" onClick={saveGamepassLinks} disabled={savingGamepassLinks}>
              {savingGamepassLinks ? <Loader2 className="h-4 w-4 animate-spin" /> : gamepassLinksSaved ? <CheckCircle className="h-4 w-4" /> : null}
              {gamepassLinksSaved ? 'تم حفظ الروابط' : 'حفظ روابط الشرح'}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ تحميل عروضك…
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {DELIVERY_TYPES.map((d) => {
                  const t = offers[d]
                  return (
                    <div
                      key={d}
                      className={`space-y-3 rounded-xl border p-4 transition-colors ${
                        t.active ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card/40'
                      }`}
                    >
                      <label className="flex cursor-pointer items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-bold">{DELIVERY_LABELS[d]}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{DELIVERY_NOTES[d]}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={t.active}
                          onChange={(e) => patchType(d, { active: e.target.checked })}
                          className="mt-1 h-4 w-4 shrink-0 accent-primary"
                        />
                      </label>
                      {d === 'gamepass' && (
                        <a
                          href={GAMEPASS_GUIDE_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                        >
                          شرح إنشاء وتسليم Gamepass للبائع
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      )}

                      <div className={t.active ? 'space-y-3' : 'space-y-3 opacity-50'}>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`av-${d}`}>الكمية المتاحة (R$)</Label>
                            <Input
                              id={`av-${d}`}
                              type="number"
                              disabled={!t.active}
                              value={t.available}
                              onChange={(e) => patchType(d, { available: +e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`rate-${d}`}>السعر / 1000 (SAR)</Label>
                            <Input
                              id={`rate-${d}`}
                              type="number"
                              step="0.1"
                              disabled={!t.active}
                              value={t.rate}
                              onChange={(e) => patchType(d, { rate: +e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`mn-${d}`}>الحد الأدنى</Label>
                            <Input
                              id={`mn-${d}`}
                              type="number"
                              disabled={!t.active}
                              value={t.min}
                              onChange={(e) => patchType(d, { min: +e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`mx-${d}`}>الحد الأقصى</Label>
                            <Input
                              id={`mx-${d}`}
                              type="number"
                              disabled={!t.active}
                              value={t.max}
                              onChange={(e) => patchType(d, { max: +e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full gap-2 sm:w-auto" onClick={saveOffers} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : null}
                {saved ? 'تم الحفظ' : 'حفظ كل العروض'}
              </Button>
            </>
          )}
        </div>
      )}

      {active === 'wallet' && (
        <div className="max-w-md space-y-4 rounded-xl border border-border/60 bg-card/40 p-5">
          <div className="text-sm text-muted-foreground">الرصيد المتاح للسحب</div>
          <div className="text-3xl font-bold text-primary">{formatMoney(user?.balance ?? 0)}</div>
          <Button className="w-full">طلب سحب الأموال</Button>
          <p className="text-xs text-muted-foreground">
            يفتح زر السحب تذكرة خاصة بينك وبين الإدارة العليا لتأكيد الإرسال.
          </p>
        </div>
      )}
    </DashboardShell>
  )
}
