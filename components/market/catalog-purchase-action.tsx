'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { AuthRequiredDialog } from '@/components/auth/auth-required-dialog'
import { TicketThread } from '@/components/dashboard/tickets-list'
import { CatalogPurchaseCheckout } from '@/components/market/catalog-purchase-checkout'
import { Button } from '@/components/ui/button'
import type { CatalogItem } from '@/lib/catalog'

export function CatalogPurchaseAction({ item }: { item: CatalogItem }) {
  const { user, ready } = useAuth()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [ticketId, setTicketId] = useState<string | null>(null)

  return (
    <>
      {item.seller.id === user?.id ? (
        <Button type="button" disabled className="w-full">هذا منتجك</Button>
      ) : user ? (
        <Button type="button" onClick={() => setCheckoutOpen(true)} disabled={!ready || item.price_sar === null || item.stock_quantity < 1} className="w-full">
          {item.stock_quantity < 1 ? 'نفدت الكمية' : item.price_sar === null ? 'بانتظار تحديد السعر' : 'شراء المنتج'}
        </Button>
      ) : (
        <Button type="button" onClick={() => setAuthDialogOpen(true)} disabled={!ready || item.price_sar === null || item.stock_quantity < 1} className="w-full">
          {item.stock_quantity < 1 ? 'نفدت الكمية' : item.price_sar === null ? 'بانتظار تحديد السعر' : 'شراء المنتج'}
        </Button>
      )}
      <AuthRequiredDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} returnTo={`/market/item/${item.id}`} />
      {checkoutOpen && <CatalogPurchaseCheckout item={item} onCancel={() => setCheckoutOpen(false)} onComplete={(id) => { setCheckoutOpen(false); setTicketId(id) }} />}
      {ticketId && <TicketThread ticketId={ticketId} role="buyer" onClose={() => setTicketId(null)} onChanged={() => {}} />}
    </>
  )
}
