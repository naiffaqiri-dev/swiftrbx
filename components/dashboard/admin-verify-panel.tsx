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

type PendingMarketplaceTicket = {
  id: string
  subject: string
  purchase_price_sar: number
  wallet_amount_sar: number | null
  payment_bank_key: string | null
  payment_sender_name: string | null
  signedReceiptUrl: string | null
}

export function AdminVerifyPanel() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [topups, setTopups] = useState<PendingTopUp[]>([])
  const [marketplaceTickets, setMarketplaceTickets] = useState<PendingMarketplaceTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [o, t, m] = await Promise.all([
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
      supabase
        .from('tickets')
        .select('id, subject, purchase_price_sar, wallet_amount_sar, payment_bank_key, payment_sender_name')
        .eq('type', 'order')
        .eq('status', 'pending_payment')
        .not('catalog_item_id', 'is', null)
        .order('created_at', { ascending: true }),
    ])
    setOrders((o.data ?? []) as PendingOrder[])
    setTopups((t.data ?? []) as PendingTopUp[])
    const pendingTickets = (m.data ?? []) as Omit<PendingMarketplaceTicket, 'signedReceiptUrl'>[]
    const ticketsWithReceipts = await Promise.all(pendingTickets.map(async (ticket) => {
      try {
        const response = await fetch(`/api/admin/marketplace-receipt/${ticket.id}`)
        const result = response.ok ? await response.json().catch(() => ({})) : {}
        return { ...ticket, signedReceiptUrl: typeof result.signedUrl === 'string' ? result.signedUrl : null }
      } catch {
        return { ...ticket, signedReceiptUrl: null }
      }
    }))
    setMarketplaceTickets(ticketsWithReceipts)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function act(kind: 'order' | 'topup' | 'marketplace_ticket', id: string, action: 'confirm' | 'reject') {
    setBusy(id)
    setError('')
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, action }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'تعذّرت معالجة الطلب')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّرت معالجة الطلب')
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
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Receipt className="h-4 w-4 text-primary" />
          مشتريات السوق بانتظار تأكيد التحويل ({marketplaceTickets.length})
        </h2>
        {marketplaceTickets.length === 0 ? (
          <p className="rounded-xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">لا توجد مشتريات سوق بحاجة للمراجعة.</p>
        ) : marketplaceTickets.map((ticket) => (
          <VerifyCard
            key={ticket.id}
            title={ticket.subject}
            amount={formatSar(Number(ticket.purchase_price_sar))}
            bankKey={ticket.payment_bank_key}
            sender={ticket.payment_sender_name}
            receipt={ticket.signedReceiptUrl}
            detail={Number(ticket.wallet_amount_sar ?? 0) > 0 ? `استخدام المحفظة: ${formatSar(Number(ticket.wallet_amount_sar))}` : undefined}
            busy={busy === ticket.id}
            onConfirm={() => act('marketplace_ticket', ticket.id, 'confirm')}
            onReject={() => act('marketplace_ticket', ticket.id, 'reject')}
          />
        ))}
      </section>
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
              title={`${o.robux_amount.toLocaleString('en-US')} R$ → ${o.roblox_username}`}
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
  detail,
  busy,
  onConfirm,
  onReject,
}: {
  title: string
  amount: string
  bankKey: string | null
  sender: string | null
  receipt: string | null
  detail?: string
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
          {detail && <span>{detail}</span>}
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
