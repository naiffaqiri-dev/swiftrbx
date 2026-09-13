import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { TicketList } from '@/components/tickets/ticket-list'

export default function TicketsPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight">تذاكري</h1>
        <TicketList />
      </main>
      <SupportButton />
    </div>
  )
}
