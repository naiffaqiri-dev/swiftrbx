'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBank } from '@/lib/banks'
import { formatSar } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Loader2, Check, X, ExternalLink, Receipt } from 'lucide-react'

type PendingOrder = {
  id: string
  robux_amount: number
  roblox_username: string
  price_sar: number
  bank_key: string | null
  receipt_url: string | null
  sender_name: string | null
  status: string
}

type PendingTopUp = {
  id: string
  amount_sar: number
  bank_key: string | null
  receipt_url: string | null
  sender_name: string | null
}

export function AdminVerifyPanel() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [topups, setTopups] = useState<PendingTopUp[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [o, t] = await Promise.all([
      supabase
        .from('orders')
        .select('id, robux_amount, roblox_username, price_sar, bank_key, receipt_url, sender_name, status')
        .in('status', ['confirming', 'pending_payment'])
        .order('created_at', { ascending: true }),
      supabase
        .from('top_ups')
        .select('id, amount_sar, bank_key, receipt_url, sender_name')
        .eq('status', 'confirming')
        .order('created_at', { ascending: true }),
    ])
    setOrders((o.data ?? []) as PendingOrder[])
    setTopups((t.data ?? []) as PendingTopUp[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function act(kind: 'order' | 'topup', id: string, action: 'confirm' | 'reject') {
    setBusy(id)
    try {
      await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, action }),
      })
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Receipt className="h-4 w-4 text-primary" />
          طلبات شراء بانتظار تأكيد التحويل ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            لا توجد طلبات بحاجة لمراجعة.
          </p>
        ) : (
          orders.map((o) => (
            <VerifyCard
              key={o.id}
              title={`${o.robux_amount.toLocaleString()} R$ → ${o.roblox_username}`}
              amount={formatSar(Number(o.price_sar))}
              bankKey={o.bank_key}
              sender={o.sender_name}
              receipt={o.receipt_url}
              busy={busy === o.id}
              onConfirm={() => act('order', o.id, 'confirm')}
              onReject={() => act('order', o.id, 'reject')}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Receipt className="h-4 w-4 text-primary" />
          طلبات شحن رصيد بانتظار التأكيد ({topups.length})
        </h2>
        {topups.length === 0 ? (
          <p className="rounded-xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            لا توجد طلبات شحن.
          </p>
        ) : (
          topups.map((t) => (
            <VerifyCard
              key={t.id}
              title="شحن رصيد"
              amount={formatSar(Number(t.amount_sar))}
              bankKey={t.bank_key}
              sender={t.sender_name}
              receipt={t.receipt_url}
              busy={busy === t.id}
              onConfirm={() => act('topup', t.id, 'confirm')}
              onReject={() => act('topup', t.id, 'reject')}
            />
          ))
        )}
      </section>
    </div>
  )
}

function VerifyCard({
  title,
  amount,
  bankKey,
  sender,
  receipt,
  busy,
  onConfirm,
  onReject,
}: {
  title: string
  amount: string
  bankKey: string | null
  sender: string | null
  receipt: string | null
  busy: boolean
  onConfirm: () => void
  onReject: () => void
}) {
  const bank = getBank(bankKey)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="font-medium">{title}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>المبلغ: {amount}</span>
          <span>البنك: {bank?.nameAr ?? '—'}</span>
          <span>المحوّل: {sender ?? '—'}</span>
        </div>
        {receipt && (
          <a
            href={receipt}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> عرض الإيصال
          </a>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm} disabled={busy} className="gap-1">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          تأكيد
        </Button>
        <Button size="sm" variant="secondary" onClick={onReject} disabled={busy} className="gap-1">
          <X className="h-4 w-4" />
          رفض
        </Button>
      </div>
    </div>
  )
}
