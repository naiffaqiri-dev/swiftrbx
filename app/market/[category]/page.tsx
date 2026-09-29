import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { CatalogBrowser } from '@/components/market/catalog-browser'
import { CATALOG_CATEGORY_INFO, categoryFromPath } from '@/lib/catalog'

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: path } = await params
  const category = categoryFromPath(path)
  return { title: category ? `${CATALOG_CATEGORY_INFO[category].label} | SwiftRBX` : 'المتجر | SwiftRBX' }
}

export default async function CatalogCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: path } = await params
  const category = categoryFromPath(path)
  if (!category) notFound()
  const info = CATALOG_CATEGORY_INFO[category]
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-3 border-b border-border/60 pb-7">
          <p className="text-sm font-medium text-primary">متاجر SwiftRBX</p>
          <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{info.label}</h1>
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">{info.description}</p>
        </header>
        <CatalogBrowser category={category} />
      </main>
      <SupportButton />
    </div>
  )
}
