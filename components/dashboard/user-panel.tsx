'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/mock-auth'
import { DashboardShell, StatCard } from './dashboard-shell'
import { TopUpDialog } from './top-up-dialog'
import { OrdersList, type OrderRow } from './orders-list'
import { TicketsList } from './tickets-list'
import { SellerCatalogManager } from './seller-catalog-manager'
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_INFO, canSellCategory } from '@/lib/catalog'
import { SiteReviews } from '@/components/reviews/site-reviews'
import { MarketplaceAvailabilitySummary } from '@/components/market/marketplace-availability'
import { MarketplaceCategoryLinks } from '@/components/market/marketplace-category-links'
import { createClient } from '@/lib/supabase/client'
import { formatSar, formatUsd, sarToUsd } from '@/lib/currency'
import { Button, buttonVariants } from '@/components/ui/button'
import { LayoutDashboard, ShoppingBag, Ticket, Wallet, Plus, Headphones, MessageSquareQuote } from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'orders', label: 'طلباتي', icon: <ShoppingBag className="h-4 w-4" /> },
  { key: 'tickets', label: 'تذاكري', icon: <Ticket className="h-4 w-4" /> },
  { key: 'support', label: 'الدعم الفني', icon: <Headphones className="h-4 w-4" /> },
  { key: 'reviews', label: 'تقييم الموقع', icon: <MessageSquareQuote className="h-4 w-4" /> },
]

export function UserPanel() {
  const { user } = useAuth()
  const [active, setActive] = useState('overview')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [ticketIdByOrder, setTicketIdByOrder] = useState<Record<string, string>>({})
  const [ticketCount, setTicketCount] = useState(0)
  const catalogNav = CATALOG_CATEGORIES
    .filter((category) => canSellCategory(user?.role, user?.sellerPermissions, category))
    .map((category) => ({ key: `catalog-${category}`, label: `متجر ${CATALOG_CATEGORY_INFO[category].label}`, icon: <ShoppingBag className="h-4 w-4" /> }))

  const load = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    const [o, t] = await Promise.all([
      supabase
        .from('orders')
        .select('id, robux_amount, roblox_username, delivery_method, price_sar, status, created_at')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('tickets').select('id, order_id, type, status').eq('buyer_id', user.id),
    ])
    const orderRows = (o.data ?? []) as OrderRow[]
    const ticketRows = (t.data ?? []) as { id: string; order_id: string | null; type: string; status: string }[]
    const ordersById = new Map(orderRows.map((order) => [order.id, order]))
    setOrders(orderRows)
    setTicketIdByOrder(
      Object.fromEntries(ticketRows.flatMap((ticket) => ticket.order_id ? [[ticket.order_id, ticket.id]] : [])),
    )
    setTicketCount(
      ticketRows.filter(
        (ticket) =>
          ticket.type === 'order' &&
          ticket.status === 'closed' &&
          ticket.order_id &&
          ordersById.get(ticket.order_id)?.status === 'rejected',
      ).length,
    )
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const balance = user?.balance ?? 0

  return (
    <DashboardShell title="لوحتي" nav={[...NAV, ...catalogNav]} active={active} onNavigate={setActive}>
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
          <MarketplaceAvailabilitySummary />
          <MarketplaceCategoryLinks />
          <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">ابدأ عملية شراء روبوكس الآن</p>
            <Link href="/market" className={buttonVariants()}>
              اشترِ روبوكس
            </Link>
          </div>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">التذاكر النشطة</h2>
            <TicketsList
              role="buyer"
              types={['order', 'dispute']}
              statuses={['open', 'pending_payment', 'delivered', 'disputed']}
            />
          </section>
        </div>
      )}

      {active === 'orders' && (
        <OrdersList orders={orders} ticketIdByOrder={ticketIdByOrder} onChanged={load} />
      )}

      {active === 'tickets' && <TicketsList role="buyer" types={['order', 'dispute']} />}

      {active === 'support' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
            هل تحتاج مساعدة؟ افتح تذكرة دعم جديدة وسيتواصل معك فريق الدعم الفني مباشرة من هنا.
          </div>
          <TicketsList role="buyer" types={['support']} allowCreate />
        </div>
      )}

      {active === 'reviews' && <SiteReviews />}
      {CATALOG_CATEGORIES.map((category) => active === `catalog-${category}` && canSellCategory(user?.role, user?.sellerPermissions, category) ? <SellerCatalogManager key={category} category={category} /> : null)}

      {topUpOpen && <TopUpDialog onClose={() => setTopUpOpen(false)} />}
    </DashboardShell>
  )
}
