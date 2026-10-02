'use client'

import { useState } from 'react'
import { useLocale } from '@/components/i18n/locale-provider'
import { DELIVERY_LABELS, type DeliveryType } from '@/lib/mock-data'
import { formatSar } from '@/lib/currency'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TicketThread } from './tickets-list'
import { OrderConfirmationDialog } from './order-confirmation-dialog'

export type OrderRow = {
  id: string
  robux_amount: number
  roblox_username: string
  delivery_method: string
  price_sar: number
  status: string
  created_at: string
}

export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: 'بانتظار الدفع', cls: 'bg-amber-500/15 text-amber-400' },
  confirming: { label: 'قيد تأكيد التحويل', cls: 'bg-amber-500/15 text-amber-400' },
  processing: { label: 'قيد التنفيذ', cls: 'bg-sky-500/15 text-sky-400' },
  delivered: { label: 'تم التسليم', cls: 'bg-primary/20 text-primary' },
  completed: { label: 'مكتمل', cls: 'bg-primary/20 text-primary' },
  rejected: { label: 'مرفوض', cls: 'bg-destructive/15 text-destructive' },
  disputed: { label: 'نزاع', cls: 'bg-destructive/15 text-destructive' },
}

export function OrdersList({
  orders,
  ticketIdByOrder = {},
  onChanged,
}: {
  orders: OrderRow[]
  ticketIdByOrder?: Record<string, string>
  onChanged?: () => void
}) {
  const { t } = useLocale()
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null)

  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        {t('لا توجد طلبات بعد.')}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const st = ORDER_STATUS[o.status] ?? { label: o.status, cls: 'bg-muted text-muted-foreground' }
        const ticketId = ticketIdByOrder[o.id]
        const isCompletedAndOpenable = o.status === 'completed' && Boolean(ticketId)
        const cardClass = 'flex w-full flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 text-start sm:flex-row sm:items-center sm:justify-between'
        const cardContent = (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Package className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="font-medium">{o.robux_amount.toLocaleString('en-US')} R$</div>
                <div className="text-pretty text-xs text-muted-foreground">
                  {t(DELIVERY_LABELS[o.delivery_method as DeliveryType] ?? o.delivery_method)} · {o.roblox_username}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              <span className="font-semibold">{formatSar(Number(o.price_sar))}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{t(st.label)}</span>
              {o.status === 'delivered' && (
                <Button type="button" size="sm" onClick={() => setConfirmOrderId(o.id)} className="shrink-0">
                  {t('تأكيد الاستلام')}
                </Button>
              )}
              {isCompletedAndOpenable && <span className="text-xs font-medium text-primary">{t('عرض التفاصيل')}</span>}
            </div>
          </>
        )

        return isCompletedAndOpenable ? (
          <button
            key={o.id}
            type="button"
            onClick={() => setOpenTicketId(ticketId)}
            aria-label={`${t('تفاصيل الطلب المكتمل')} ${o.robux_amount.toLocaleString('en-US')} Robux`}
            className={`${cardClass} cursor-pointer transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
          >
            {cardContent}
          </button>
        ) : (
          <div key={o.id} className={cardClass}>
            {cardContent}
          </div>
        )
      })}
      {openTicketId && (
        <TicketThread ticketId={openTicketId} role="buyer" onClose={() => setOpenTicketId(null)} onChanged={onChanged ?? (() => {})} />
      )}
      {confirmOrderId && (
        <OrderConfirmationDialog
          orderId={confirmOrderId}
          open
          onOpenChange={(open) => { if (!open) setConfirmOrderId(null) }}
          onComplete={() => { setConfirmOrderId(null); onChanged?.() }}
        />
      )}
    </div>
  )
}
