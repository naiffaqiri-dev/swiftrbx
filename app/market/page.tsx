import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { RobuxPurchase } from '@/components/market/robux-purchase'

export default function MarketPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">
            اشترِ <span className="text-primary">الروبكس</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            حدّد الكمية ونوع التسليم، وسنعرض لك البائعين المطابقين تلقائياً مرتّبين حسب الأفضل.
          </p>
        </div>
        <RobuxPurchase />
      </main>
      <SupportButton />
    </div>
  )
}
