import { Suspense } from 'react'
import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { Checkout } from '@/components/market/checkout'
import { DiscordTicketPayment } from '@/components/market/discord-ticket-payment'

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ discordTicketPayment?: string | string[] }>
}) {
  const { discordTicketPayment } = await searchParams
  const ticketToken = typeof discordTicketPayment === 'string' && discordTicketPayment.length > 0
    ? discordTicketPayment
    : null

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight">إتمام الدفع</h1>
        {ticketToken ? (
          <DiscordTicketPayment token={ticketToken} />
        ) : (
          <Suspense fallback={<p className="text-muted-foreground">جارٍ التحميل…</p>}>
            <Checkout />
          </Suspense>
        )}
      </main>
      <SupportButton />
    </div>
  )
}
