'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/mock-auth'
import { DashboardShell, StatCard } from './dashboard-shell'
import { TopUpDialog } from './top-up-dialog'
import { OrdersList, type OrderRow } from './orders-list'
import { TicketsList } from './tickets-list'
import { createClient } from '@/lib/supabase/client'
import { formatSar, formatUsd, sarToUsd } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, ShoppingBag, Ticket, Wallet, Plus } from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'orders', label: 'طلباتي', icon: <ShoppingBag className="h-4 w-4" /> },
  { key: 'tickets', label: 'تذاكري', icon: <Ticket className="h-4 w-4" /> },
]

export function UserPanel() {
  const { user } = useAuth()
  const [active, setActive] = useState('overview')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [ticketCount, setTicketCount] = useState(0)

  const load = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    const [o, t] = await Promise.all([
      supabase
        .from('orders')
        .select('id, robux_amount, roblox_username, delivery_method, price_sar, status, created_at')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id),
    ])
    setOrders((o.data ?? []) as OrderRow[])
    setTicketCount(t.count ?? 0)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const balance = user?.balance ?? 0

  return (
    <DashboardShell title="لوحتي" nav={NAV} active={active} onNavigate={setActive}>
      {active === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-5 w-5 text-primary" /> رصيدي
                </span>
                <Button size="sm" onClick={() => setTopUpOpen(true)} className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" /> شحن
                </Button>
              </div>
              <div className="mt-3 text-3xl font-bold text-primary">{formatSar(balance)}</div>
              <div className="text-xs text-muted-foreground">≈ {formatUsd(sarToUsd(balance))}</div>
            </div>
            <StatCard label="عدد المشتريات" value={orders.length} icon={<ShoppingBag className="h-5 w-5" />} />
            <StatCard label="تذاكري" value={ticketCount} icon={<Ticket className="h-5 w-5" />} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">ابدأ عملية شراء روبوكس الآن</p>
            <Button asChild>
              <Link href="/market">اشترِ روبوكس</Link>
            </Button>
          </div>
          {orders.length > 0 && <OrdersList orders={orders.slice(0, 5)} />}
        </div>
      )}

      {active === 'orders' && <OrdersList orders={orders} />}

      {active === 'tickets' && <TicketsList role="buyer" />}

      {topUpOpen && <TopUpDialog onClose={() => setTopUpOpen(false)} />}
    </DashboardShell>
  )
}
