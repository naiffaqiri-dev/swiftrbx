import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { TicketChat } from '@/components/tickets/ticket-chat'

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <TicketChat ticketId={id} />
      </main>
      <SupportButton />
    </div>
  )
}
