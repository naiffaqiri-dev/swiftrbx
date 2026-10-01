'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, PackageCheck, RefreshCw } from 'lucide-react'

type TransferredTicket = {
  ticketId: string
  subject: string
  transferredAt: string | null
  transferReason: string | null
  robuxAmount: number
  robloxUsername: string
  deliveryMethod: string
  priceSar: number
  buyerUsername: string
  previousSellerUsername: string
}

export function TransferredTicketQueue() {
  const [tickets, setTickets] = useState<TransferredTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/tickets/transfer', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'تعذّر تحميل التذاكر المحوّلة')
      setTickets(result.tickets ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذّر تحميل التذاكر المحوّلة')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function claim(ticketId: string) {
    if (claimingId) return
    setClaimingId(ticketId)
    setNotice('')
    setError('')
    try {
      const response = await fetch('/api/tickets/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, action: 'claim' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'تعذّر استلام التذكرة')
      setTickets((current) => current.filter((ticket) => ticket.ticketId !== ticketId))
      setNotice('تم استلام التذكرة وإضافتها إلى تذاكرك النشطة.')
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : 'تعذّر استلام التذكرة')
      await load()
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="transferred-tickets-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="transferred-tickets-title" className="text-lg font-bold">التذاكر المحوّلة</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            طلبات لم يستطع البائع السابق إكمالها. استلم تذكرة لتصبح ضمن تذاكرك النشطة.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw data-icon="inline-start" /> تحديث القائمة
        </Button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">{notice}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ تحميل التذاكر المحوّلة…
        </div>
      ) : tickets.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          لا توجد تذاكر محوّلة متاحة للاستلام حالياً.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <li key={ticket.ticketId} className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="size-4 shrink-0 text-primary" />
                    <h3 className="truncate font-semibold">{ticket.subject || 'طلب روبوكس'}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    المشتري: <span className="font-medium text-foreground">{ticket.buyerUsername || ticket.robloxUsername}</span>
                    {' · حساب Roblox: '}<span className="font-medium text-foreground">{ticket.robloxUsername}</span>
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    الكمية: <span className="font-medium text-foreground">{Number(ticket.robuxAmount).toLocaleString('en-US')} Robux</span>
                    {' · التسليم: '}<span className="font-medium text-foreground">{ticket.deliveryMethod || 'غير محدد'}</span>
                    {' · السعر: '}<span className="font-medium text-foreground">{Number(ticket.priceSar).toFixed(2)} ر.س</span>
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    حوّلها: <span className="font-medium text-foreground">{ticket.previousSellerUsername || 'بائع سابق'}</span>
                    {ticket.transferredAt ? ` · ${new Date(ticket.transferredAt).toLocaleString('ar')}` : ''}
                  </p>
                  {ticket.transferReason && (
                    <p className="mt-2 rounded-lg bg-muted/40 p-3 text-sm leading-relaxed text-foreground">
                      سبب التحويل: {ticket.transferReason}
                    </p>
                  )}
                </div>
                <Button type="button" onClick={() => void claim(ticket.ticketId)} disabled={claimingId !== null} className="shrink-0">
                  {claimingId === ticket.ticketId ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <PackageCheck data-icon="inline-start" />}
                  استلام التذكرة
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
