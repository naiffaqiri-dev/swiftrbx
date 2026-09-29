'use client'

import Link from 'next/link'
import { ArrowLeft, Gamepad2, Gem, UserRound } from 'lucide-react'
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_INFO, CATALOG_PATHS, type CatalogCategory } from '@/lib/catalog'

const CATEGORY_ICONS: Record<CatalogCategory, typeof Gem> = {
  limited: Gem,
  account: UserRound,
  map_item: Gamepad2,
}

export function MarketplaceCategoryLinks() {
  return (
    <section aria-labelledby="marketplace-category-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="marketplace-category-heading" className="text-base font-semibold">تصفّح متاجر اللاعبين</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">اختر نوع المتجر للوصول مباشرة إلى العروض المتاحة.</p>
      </div>
      <nav aria-label="متاجر اللاعبين" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CATALOG_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category]
          const info = CATALOG_CATEGORY_INFO[category]

          return (
            <Link
              key={category}
              href={CATALOG_PATHS[category]}
              className="group flex min-h-28 items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">متجر {info.label}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{info.description}</p>
                </div>
              </div>
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
            </Link>
          )
        })}
      </nav>
    </section>
  )
}
