import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { CatalogBrowser } from '@/components/market/catalog-browser'

export async function generateMetadata({ params }: { params: Promise<{ sellerId: string }> }): Promise<Metadata> {
  const { sellerId } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('username, display_name').eq('id', sellerId).maybeSingle()
  const seller = data?.display_name || data?.username || 'متجر البائع'
  return { title: `${seller} | SwiftRBX`, description: `تصفح المنتجات المتاحة في متجر ${seller}.` }
}

export default async function SellerStorePage({ params }: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await params
  const admin = createAdminClient()
  const { data: seller } = await admin.from('profiles').select('id, username, display_name, avatar_url').eq('id', sellerId).eq('active', true).maybeSingle()
  if (!seller) notFound()
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-center gap-4 border-b border-border/60 pb-7">
          {seller.avatar_url ? <img src={seller.avatar_url} alt="" className="size-16 rounded-full object-cover" /> : <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">{(seller.display_name || seller.username).slice(0, 2).toUpperCase()}</div>}
          <div><p className="text-sm text-muted-foreground">متجر البائع</p><h1 className="mt-1 text-2xl font-extrabold">{seller.display_name || seller.username}</h1><p className="mt-1 text-sm text-muted-foreground">@{seller.username}</p></div>
        </header>
        <div className="flex flex-col gap-8">
          <CatalogBrowser category="limited" sellerId={seller.id} />
          <CatalogBrowser category="account" sellerId={seller.id} />
          <CatalogBrowser category="map_item" sellerId={seller.id} />
        </div>
      </main>
      <SupportButton />
    </div>
  )
}
