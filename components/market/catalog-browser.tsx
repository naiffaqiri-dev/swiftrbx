'use client'

import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { useMemo, useState } from 'react'
import { ArrowUpRight, Gamepad2, Loader2, Search, Store } from 'lucide-react'
import { useAuth } from '@/components/auth/mock-auth'
import { TicketThread } from '@/components/dashboard/tickets-list'
import { StarDisplay } from '@/components/reviews/star-rating'
import { Button } from '@/components/ui/button'
import { CATALOG_CATEGORY_INFO, CATALOG_PATHS, type CatalogCategory, type CatalogItem } from '@/lib/catalog'
import { Input } from '@/components/ui/input'

const fetcher = async (url: string): Promise<{ items: CatalogItem[] }> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('تعذّر تحميل المنتجات')
  return response.json()
}

export function CatalogBrowser({ category, sellerId }: { category: CatalogCategory; sellerId?: string }) {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [purchaseBusyId, setPurchaseBusyId] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState('')
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState('')
  const url = `/api/catalog?${new URLSearchParams({ category, ...(sellerId ? { sellerId } : {}) })}`
  const { data, error, isLoading } = useSWR(url, fetcher)
  const items = data?.items ?? []
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => (!selectedGame || item.game === selectedGame)
      && (!term || [item.name, item.description, item.game, item.seller.username, item.seller.display_name]
        .some((value) => value?.toLowerCase().includes(term))))
  }, [items, search, selectedGame])
  const games = useMemo(() => [...new Set(items.map((item) => item.game).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [items])
  const info = CATALOG_CATEGORY_INFO[category]
  const groupedSellers = useMemo(() => [...new Set(filtered.map((item) => item.seller.id))].length, [filtered])

  async function requestPurchase(item: CatalogItem) {
    if (!user || purchaseBusyId) return
    setPurchaseBusyId(item.id)
    setPurchaseError('')
    const response = await fetch('/api/catalog/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'purchase', itemId: item.id }),
    }).catch(() => null)
    const result = response ? await response.json().catch(() => ({})) : {}
    if (!response?.ok) setPurchaseError(result.error ?? 'تعذّر إرسال طلب الشراء')
    else if (typeof result.ticketId === 'string') setTicketId(result.ticketId)
    else setPurchaseError('أُرسل الطلب، لكن تعذّر فتح التذكرة تلقائياً')
    setPurchaseBusyId(null)
  }

  return (
    <div className="flex flex-col gap-7">
      {!sellerId && (
        <nav aria-label="أقسام المتجر" className="flex flex-wrap gap-2">
          {(Object.keys(CATALOG_PATHS) as CatalogCategory[]).map((key) => (
            <Link
              key={key}
              href={CATALOG_PATHS[key]}
              aria-current={key === category ? 'page' : undefined}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${key === category ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 bg-card/50 text-muted-foreground hover:text-foreground'}`}
            >
              {CATALOG_CATEGORY_INFO[key].label}
            </Link>
          ))}
        </nav>
      )}
      {purchaseError && <p role="alert" className="rounded-lg border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">{purchaseError}</p>}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Store className="size-4" /> {groupedSellers.toLocaleString('ar-SA')} بائعين</div>
          <h2 className="mt-2 text-xl font-bold">{sellerId ? 'المعروض من هذا المتجر' : 'تصفّح المتاجر والمنتجات'}</h2>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {category === 'map_item' && games.length > 0 && <select value={selectedGame} onChange={(event) => setSelectedGame(event.target.value)} aria-label="تصفية حسب اللعبة" className="h-10 rounded-md border border-border/60 bg-background px-3 text-sm"><option value="">كل الألعاب</option>{games.map((game) => <option key={game} value={game}>{game}</option>)}</select>}
          <label className="relative block w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالاسم أو اللعبة أو البائع" className="pr-9" aria-label="ابحث في المنتجات" />
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl border border-border/60 bg-card/40" />)}</div>
      ) : error ? (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-card p-5 text-sm text-destructive">{error.message}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Gamepad2 className="size-5" /></span>
          <h3 className="font-semibold">لا توجد منتجات معروضة بعد</h3>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{info.description}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <article key={item.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/50 transition-colors hover:border-primary/50">
              <Link href={`/market/store/${item.seller.id}`} className="relative block aspect-[4/3] overflow-hidden bg-muted" aria-label={`فتح متجر ${item.seller.display_name || item.seller.username}`}>
                <Image src={item.image_url} alt={item.name} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" unoptimized />
                {category === 'map_item' && <span className="absolute bottom-3 right-3 rounded-full border border-border/50 bg-background/90 px-3 py-1 text-xs font-medium"><Gamepad2 className="ml-1 inline size-3.5" />{item.game}</span>}
              </Link>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-base font-bold leading-6">{item.name}</h3>
                  <Link href={`/market/store/${item.seller.id}`} aria-label="افتح متجر البائع" className="shrink-0 rounded-full border border-border/70 p-2 text-muted-foreground transition-colors hover:text-primary"><ArrowUpRight className="size-4" /></Link>
                </div>
                {item.description && <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                  <div className="min-w-0">
                    <Link href={`/market/store/${item.seller.id}`} className="block truncate text-sm font-semibold hover:text-primary">{item.seller.display_name || item.seller.username}</Link>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><StarDisplay value={item.seller.rating} size={13} /><span>{item.seller.rating_count ? `(${item.seller.rating_count})` : 'بائع جديد'}</span></span>
                  </div>
                  <div className="shrink-0 text-left">
                    <span className="block text-sm font-bold">{item.price_sar !== null ? `${Number(item.price_sar).toFixed(2)} ر.س` : 'السعر غير محدد'}</span>
                    <span className="text-xs text-muted-foreground">{info.singular}</span>
                  </div>
                </div>
                {item.links.length > 0 && <div className="flex flex-wrap gap-2">{item.links.map((href, index) => <a key={`${item.id}-${index}`} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:text-primary">رابط {index + 1}<ArrowUpRight className="size-3" /></a>)}</div>}
                {item.seller.id !== user?.id && (user ? (
                  <Button onClick={() => requestPurchase(item)} disabled={purchaseBusyId !== null || item.price_sar === null} className="w-full">
                    {purchaseBusyId === item.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    {item.price_sar === null ? 'بانتظار تحديد السعر' : 'طلب شراء عبر تذكرة'}
                  </Button>
                ) : (
                  <Link href="/login" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">سجّل الدخول للشراء</Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {ticketId && <TicketThread ticketId={ticketId} role="buyer" onClose={() => setTicketId(null)} onChanged={() => {}} />}
    </div>
  )
}
