import { Suspense } from 'react'
import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { Checkout } from '@/components/market/checkout'

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const paymentTokenValue = query?.discordTicketPayment
  const initialDiscordTicketPaymentToken = Array.isArray(paymentTokenValue)
    ? paymentTokenValue[0] ?? ''
    : paymentTokenValue ?? ''

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight">إتمام الدفع</h1>
        <Suspense fallback={<p className="text-muted-foreground">جارٍ التحميل…</p>}>
          <Checkout initialDiscordTicketPaymentToken={initialDiscordTicketPaymentToken} />
        </Suspense>
      </main>
      <SupportButton />
    </div>
  )
}
