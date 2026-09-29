import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowUpRight, Gamepad2, Package, Store } from 'lucide-react'
import { CatalogPurchaseAction } from '@/components/market/catalog-purchase-action'
import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { StarDisplay } from '@/components/reviews/star-rating'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_INFO, type CatalogCategory, type CatalogItem } from '@/lib/catalog'

async function getCatalogItem(itemId: string): Promise<CatalogItem | null> {
  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('marketplace_catalog_items')
    .select('id, seller_id, category, name, description, image_url, links, game, active, created_at, price_sar, stock_quantity, map_category, game_emoji, map_category_emoji, map_thumbnail_url, map_url')
    .eq('id', itemId)
    .eq('active', true)
    .maybeSingle()

  if (error || !row || !CATALOG_CATEGORIES.includes(row.category as CatalogCategory)) return null

  const { data: seller } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url, rating, rating_count')
    .eq('id', row.seller_id)
    .eq('active', true)
    .maybeSingle()

  if (!seller) return null

  return {
    ...row,
    category: row.category as CatalogCategory,
    links: Array.isArray(row.links) ? row.links : [],
    price_sar: row.price_sar === null ? null : Number(row.price_sar),
    stock_quantity: Number(row.stock_quantity ?? 0),
    seller: {
      ...seller,
      rating: Number(seller.rating ?? 0),
      rating_count: Number(seller.rating_count ?? 0),
    },
  } as CatalogItem
}

export async function generateMetadata({ params }: { params: Promise<{ itemId: string }> }): Promise<Metadata> {
  const { itemId } = await params
  const item = await getCatalogItem(itemId)
  if (!item) return { title: 'المنتج غير موجود | SwiftRBX' }
  const description = item.description?.trim() || `${item.name} من متجر ${item.seller.display_name || item.seller.username} على SwiftRBX.`
  return {
    title: `${item.name} | SwiftRBX`,
    description: description.slice(0, 160),
    openGraph: { title: `${item.name} | SwiftRBX`, description: description.slice(0, 160), images: [item.image_url] },
  }
}

export default async function CatalogItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const item = await getCatalogItem(itemId)
  if (!item) notFound()

  const categoryInfo = CATALOG_CATEGORY_INFO[item.category]
  const sellerName = item.seller.display_name || item.seller.username

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-7 px-4 py-8 sm:px-6 sm:py-12">
        <Link href={item.category === 'map_item' ? '/market/map-items' : item.category === 'account' ? '/market/accounts' : '/market/limiteds'} className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowRight className="size-4" aria-hidden="true" /> العودة إلى {categoryInfo.label}
        </Link>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)] lg:items-start">
          <article className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
            <div className="relative aspect-[4/3] overflow-hidden bg-muted sm:aspect-[16/10]">
              <Image src={item.image_url} alt={item.name} fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-contain" unoptimized />
            </div>
            <div className="flex flex-col gap-5 p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{categoryInfo.label}</span>
                {item.category === 'map_item' && <><span aria-hidden="true">/</span><span className="inline-flex items-center gap-1.5">{item.game_emoji || <Gamepad2 className="size-4" aria-hidden="true" />}{item.game}</span></>}
                {item.map_category && <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs">{item.map_category_emoji}{item.map_category}</span>}
              </div>
              <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">{item.name}</h1>
              {item.description ? (
                <section aria-labelledby="product-description-title" className="flex flex-col gap-2 border-t border-border/60 pt-5">
                  <h2 id="product-description-title" className="text-lg font-bold">وصف المنتج</h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </section>
              ) : (
                <p className="border-t border-border/60 pt-5 text-sm leading-relaxed text-muted-foreground">لا يوجد وصف إضافي لهذا المنتج.</p>
              )}
              {(item.map_url || item.links.length > 0) && (
                <section aria-labelledby="product-links-title" className="flex flex-col gap-3 border-t border-border/60 pt-5">
                  <h2 id="product-links-title" className="text-lg font-bold">روابط المنتج</h2>
                  <div className="flex flex-wrap gap-2">
                    {item.map_url && <a href={item.map_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10">رابط الماب<ArrowUpRight className="size-4" aria-hidden="true" /></a>}
                    {item.links.map((href, index) => <a key={`${item.id}-${index}`} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-primary">رابط {index + 1}<ArrowUpRight className="size-4" aria-hidden="true" /></a>)}
                  </div>
                </section>
              )}
            </div>
          </article>

          <aside className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card/60 p-5 sm:p-6 lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">السعر</p>
                <p className="mt-1 text-2xl font-extrabold">{item.price_sar !== null ? `${Number(item.price_sar).toFixed(2)} ر.س` : 'السعر غير محدد'}</p>
              </div>
              <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">{categoryInfo.singular}</span>
            </div>
            <div className="flex items-center justify-between border-y border-border/60 py-4 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground"><Package className="size-4" aria-hidden="true" /> الكمية المتاحة</span>
              <span className="font-semibold">{item.stock_quantity > 0 ? item.stock_quantity.toLocaleString('ar-SA') : 'نفدت الكمية'}</span>
            </div>
            <CatalogPurchaseAction item={item} />
            <div className="flex flex-col gap-3 border-t border-border/60 pt-5">
              <p className="text-xs font-medium text-muted-foreground">البائع</p>
              <div className="flex items-center gap-3">
                {item.seller.avatar_url ? (
                  <Image src={item.seller.avatar_url} alt={`صورة ${sellerName}`} width={44} height={44} className="size-11 rounded-full border border-border/70 object-cover" unoptimized />
                ) : (
                  <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-muted text-sm font-bold">{sellerName.slice(0, 2).toUpperCase()}</span>
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/market/store/${item.seller.id}`} className="block truncate font-semibold hover:text-primary">{sellerName}</Link>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><StarDisplay value={item.seller.rating} size={12} /><span>{item.seller.rating_count ? `(${item.seller.rating_count})` : 'بائع جديد'}</span></span>
                </div>
                <Link href={`/market/store/${item.seller.id}`} aria-label={`زيارة متجر ${sellerName}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:text-primary"><Store className="size-4" aria-hidden="true" /></Link>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SupportButton />
    </div>
  )
}
