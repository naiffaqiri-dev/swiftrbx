'use client'

import { DELIVERY_LABELS, type DeliveryType } from '@/lib/mock-data'
import { formatSar } from '@/lib/currency'
import { Package } from 'lucide-react'

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

export function OrdersList({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        لا توجد طلبات بعد.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const st = ORDER_STATUS[o.status] ?? { label: o.status, cls: 'bg-muted text-muted-foreground' }
        return (
          <div
            key={o.id}
            className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <div className="font-medium">{o.robux_amount.toLocaleString()} R$</div>
                <div className="text-xs text-muted-foreground">
                  {DELIVERY_LABELS[o.delivery_method as DeliveryType] ?? o.delivery_method} · {o.roblox_username}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <span className="font-semibold">{formatSar(Number(o.price_sar))}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
