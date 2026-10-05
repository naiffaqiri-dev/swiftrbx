'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import {
  DELIVERY_LABELS,
  DELIVERY_NOTES,
  GAMEPASS_GUIDE_URL,
  getGamepassNetAmount,
  getDisplayOffers,
  isHttpsLink,
  isRobloxGroupLink,
  type ActiveOffer,
  type DeliveryType,
} from '@/lib/mock-data'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/mock-auth'
import { AuthRequiredDialog } from '@/components/auth/auth-required-dialog'
import { ProfileAvatar } from '@/components/profile-avatar'
import { formatMoney } from '@/lib/currency'
import { useLocale } from '@/components/i18n/locale-provider'
import { DeliveryAvailability, MarketplaceAvailabilitySummary } from '@/components/market/marketplace-availability'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Star, Package, Truck, Zap, CheckCircle2, ExternalLink } from 'lucide-react'

type SellerProfile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  sales: number | null
}

type MarketplaceData = {
  offers: ActiveOffer[]
  sellerProfiles: Record<string, SellerProfile>
  groupLinks: Record<string, string[]>
  gamepassLinks: Record<string, string[]>
}

export function RobuxPurchase() {
  const router = useRouter()
  const { t } = useLocale()
  const { user, ready } = useAuth()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authReturnTo, setAuthReturnTo] = useState('/market')
  const [amount, setAmount] = useState<number>(1000)
  const [delivery, setDelivery] = useState<DeliveryType>('group')
  const [selected, setSelected] = useState<string | null>(null)
  const {
    data: marketplaceData,
    error: marketplaceError,
    isLoading: loading,
    mutate: retryMarketplace,
  } = useSWR<MarketplaceData>('marketplace-purchase-data', async () => {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('active_offers')
    if (error) throw error

    const offers = (data ?? []) as ActiveOffer[]
    const sellerIds = [...new Set(offers.map((offer) => offer.seller_id).filter(Boolean))]
    if (sellerIds.length === 0) {
      return { offers, sellerProfiles: {}, groupLinks: {}, gamepassLinks: {} }
    }

    const [{ data: publicLinks }, { data: publicGamepassLinks }, publicSellerProfiles] = await Promise.all([
      supabase.rpc('active_seller_group_links'),
      supabase.rpc('active_seller_gamepass_links'),
      fetch(`/api/market/seller-profiles?sellerIds=${encodeURIComponent(sellerIds.join(','))}`, { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) return [] as SellerProfile[]
          const result = await response.json() as { sellers?: SellerProfile[] }
          return result.sellers ?? []
        })
        .catch(() => [] as SellerProfile[]),
    ])

    const sellerProfiles = Object.fromEntries(publicSellerProfiles.map((profile) => [profile.id, profile]))
    const sellerLinkRows = (publicLinks ?? []) as { seller_id: string; group_links: unknown }[]
    const groupLinks = Object.fromEntries(
      sellerLinkRows
        .filter((row) => sellerIds.includes(row.seller_id) && Array.isArray(row.group_links) && row.group_links.every(isRobloxGroupLink))
        .map((row) => [row.seller_id, row.group_links as string[]]),
    )
    const sellerGamepassLinkRows = (publicGamepassLinks ?? []) as { seller_id: string; gamepass_links: unknown }[]
    const gamepassLinks = Object.fromEntries(
      sellerGamepassLinkRows
        .filter((row) => sellerIds.includes(row.seller_id) && Array.isArray(row.gamepass_links) && row.gamepass_links.every(isHttpsLink))
        .map((row) => [row.seller_id, row.gamepass_links as string[]]),
    )

    return { offers, sellerProfiles, groupLinks, gamepassLinks }
  })

  const offers = marketplaceData?.offers ?? []
  const sellerProfiles = marketplaceData?.sellerProfiles ?? {}
  const groupLinks = marketplaceData?.groupLinks ?? {}
  const gamepassLinks = marketplaceData?.gamepassLinks ?? {}
  const displayOffers = useMemo(() => getDisplayOffers(offers, amount, delivery), [offers, amount, delivery])
  const matched = displayOffers.filter((offer) => !offer.minimumNotMet)
  const chosen = matched.find((s) => s.id === selected) ?? matched[0] ?? null

  function proceed() {
    if (!chosen || !ready) return
    const params = new URLSearchParams({
      amount: String(amount),
      delivery,
      offer: chosen.id,
      seller: chosen.username,
      price: String(chosen.price),
    })
    const checkoutPath = `/checkout?${params.toString()}`
    if (!user) {
      setAuthReturnTo(checkoutPath)
      setAuthDialogOpen(true)
      return
    }
    router.push(checkoutPath)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* الإعدادات + الموردون */}
      <div className="space-y-6">
        <MarketplaceAvailabilitySummary />
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="mb-4 text-lg font-bold">حدّد طلبك</h2>

          <div className="space-y-2">
            <Label htmlFor="amount">
              {delivery === 'gamepass' ? t('كمية Gamepass قبل الضريبة') : 'كمية الروبوكس (R$)'}
            </Label>
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
                  {v.toLocaleString('en-US')}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Label>نوع التسليم</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(DELIVERY_LABELS) as DeliveryType[]).map((d) => (
                <div
                  key={d}
                  className={`rounded-xl border p-3 transition-colors ${
                    delivery === d
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 hover:border-primary/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setDelivery(d)
                      setSelected(null)
                    }}
                    aria-pressed={delivery === d}
                    className="w-full text-right"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {d === 'group' ? <Truck className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-primary" />}
                      {DELIVERY_LABELS[d]}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(DELIVERY_NOTES[d])}</p>
                  </button>
                  <DeliveryAvailability delivery={d} />
                  {d === 'gamepass' && (
                    <a
                      href={GAMEPASS_GUIDE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                    >
                      شرح إنشاء وتسليم Gamepass للبائع
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">البائعون المتاحون</h2>
            <span className="text-sm text-muted-foreground">{displayOffers.length} {t('بائع ظاهر')}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 p-8 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ تحميل البائعين…
            </div>
          ) : marketplaceError ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-8 text-center" role="alert">
              <p className="text-sm text-muted-foreground">تعذّر تحميل عروض البائعين. تحقق من اتصالك ثم حاول مرة أخرى.</p>
              <Button variant="outline" size="sm" onClick={() => void retryMarketplace().catch(() => undefined)}>
                إعادة المحاولة
              </Button>
            </div>
          ) : displayOffers.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
              لا يوجد بائع يطابق هذه الكمية ونوع التسليم حالياً. جرّب كمية مختلفة.
            </p>
          ) : (
            displayOffers.map((s) => {
              const belowMinimum = s.minimumNotMet
              const isSel = !belowMinimum && chosen?.id === s.id
              const sellerProfile = sellerProfiles[s.seller_id]
              const sellerName = sellerProfile?.display_name?.trim() || s.username
              const sellerGroupLinks = (groupLinks[s.seller_id] ?? []).filter(isRobloxGroupLink)
              const sellerGamepassLinks = (gamepassLinks[s.seller_id] ?? []).filter(isHttpsLink)
              return (
                <div key={s.id} className="flex flex-col gap-2">
                  <div className={`flex flex-col gap-2 sm:flex-row sm:items-stretch ${belowMinimum ? 'opacity-50' : ''}`}>
                    <button
                      type="button"
                      onClick={() => setSelected(s.id)}
                      disabled={belowMinimum}
                      aria-pressed={isSel}
                      className={`flex w-full flex-1 items-center justify-between rounded-xl border p-4 text-right transition-colors disabled:cursor-not-allowed ${
                        isSel ? 'border-primary bg-primary/10' : 'border-border/60 bg-card/40 hover:border-primary/40'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <ProfileAvatar
                        src={sellerProfile?.avatar_url}
                        name={sellerName}
                        className="size-10"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-medium">
                          {sellerName}
                          {isSel && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="text-xs text-muted-foreground">@{sellerProfile?.username || s.username}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-primary text-primary" />
                            {Number(s.rating).toFixed(1)}
                          </span>
                          <span>({s.rating_count} تقييم)</span>
                          <span className="flex items-center gap-0.5">
                            <Package className="h-3 w-3" />
                            {Number(s.available).toLocaleString('en-US')}
                          </span>
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {Number(sellerProfile?.sales ?? 0).toLocaleString('en-US')} عملية ناجحة
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-left">
                      <div className="text-lg font-bold text-primary">{formatMoney(s.price)}</div>
                          <div className="text-xs text-muted-foreground">لـ {amount.toLocaleString('en-US')} R$</div>
                          {delivery === 'gamepass' && (
                            <div className="text-xs font-medium text-primary">
                              {t('سيصل لحسابك')}: {getGamepassNetAmount(amount).toLocaleString('en-US')} R$
                            </div>
                          )}

                    </div>
                  </button>
                  {delivery === 'group' && sellerGroupLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 sm:max-w-56 sm:content-center">
                      {sellerGroupLinks.map((url, index) => (
                        <a
                          key={`${s.seller_id}-${url}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-disabled={belowMinimum}
                          tabIndex={belowMinimum ? -1 : undefined}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/50 ${belowMinimum ? 'pointer-events-none' : ''}`}
                        >
                          {sellerGroupLinks.length === 1 ? 'دخول قروب البائع' : `دخول المجموعة ${index + 1}`}
                          <ExternalLink className="size-4" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                    {delivery === 'gamepass' && sellerGamepassLinks.length > 0 && (
                      <div className="flex flex-wrap gap-2 sm:max-w-56 sm:content-center">
                        {sellerGamepassLinks.map((url, index) => (
                          <a
                            key={`${s.seller_id}-${url}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={belowMinimum}
                            tabIndex={belowMinimum ? -1 : undefined}
                            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/50 ${belowMinimum ? 'pointer-events-none' : ''}`}
                          >
                            {sellerGamepassLinks.length === 1 ? 'شاهد شرح البائع' : `شرح البائع ${index + 1}`}
                            <ExternalLink className="size-4" aria-hidden="true" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {belowMinimum && (
                    <p className="text-sm font-semibold text-destructive" role="status">
                      {t('الحد الأدنى لهذا البائع هو')} {Number(s.min_amount).toLocaleString('en-US')} R$
                    </p>
                  )}
                </div>
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
            <dt className="text-muted-foreground">
              {delivery === 'gamepass' ? t('كمية Gamepass قبل الضريبة') : 'الكمية'}
            </dt>
            <dd className="font-medium">{amount.toLocaleString('en-US')} R$</dd>
          </div>
          {delivery === 'gamepass' && (
            <div className="flex justify-between font-semibold text-primary" aria-live="polite">
              <dt>{t('سيصل لحسابك')}</dt>
              <dd>{getGamepassNetAmount(amount).toLocaleString('en-US')} R$</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">التسليم</dt>
            <dd className="font-medium">{DELIVERY_LABELS[delivery]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">البائع</dt>
            <dd className="font-medium">{chosen ? sellerProfiles[chosen.seller_id]?.display_name?.trim() || chosen.username : '—'}</dd>
          </div>
        </dl>
        <div className="border-t border-border/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">الإجمالي</span>
            <span className="text-2xl font-bold text-primary">{formatMoney(chosen?.price ?? 0)}</span>
          </div>
        </div>
        <Button className="w-full" size="lg" disabled={!ready || !chosen} onClick={proceed}>
          المتابعة للدفع
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          تُفتح تذكرة تلقائياً بعد الدفع لمتابعة التسليم مع الدعم.
        </p>
      </aside>
      <AuthRequiredDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} returnTo={authReturnTo} />
    </div>
  )
}
