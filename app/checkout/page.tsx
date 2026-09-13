import { Suspense } from 'react'
import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { Checkout } from '@/components/market/checkout'

export default function CheckoutPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight">إتمام الدفع</h1>
        <Suspense fallback={<p className="text-muted-foreground">جارٍ التحميل…</p>}>
          <Checkout />
        </Suspense>
      </main>
      <SupportButton />
    </div>
  )
}
