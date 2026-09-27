'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { Coins as CoinsIcon, Store as StoreIcon, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DELIVERY_TYPES, type ActiveOffer, type DeliveryType } from '@/lib/mock-data'

function useMarketplaceAvailability() {
  const { data: offers, error, isLoading } = useSWR<ActiveOffer[]>(
    'marketplace-active-offers',
    async () => {
      const { data, error } = await createClient().rpc('active_offers')
      if (error) throw error
      return (data ?? []) as ActiveOffer[]
    },
  )

  const totals = useMemo(() => {
    const rows = offers ?? []
    const byDelivery = Object.fromEntries(
      DELIVERY_TYPES.map((delivery) => [
        delivery,
        rows.reduce((total, offer) =>
          Array.isArray(offer.delivery) && offer.delivery.includes(delivery)
            ? total + Math.max(0, Number(offer.available) || 0)
            : total, 0),
      ]),
    ) as Record<DeliveryType, number>

    return {
      robux: rows.reduce((total, offer) => total + Math.max(0, Number(offer.available) || 0), 0),
      sellers: new Set(rows.map((offer) => offer.seller_id).filter(Boolean)).size,
      byDelivery,
    }
  }, [offers])

  return { ...totals, error, isLoading }
}

function AvailabilityCard({
  label,
  value,
  icon: Icon,
  loading,
  failed,
}: {
  label: string
  value: string
  icon: LucideIcon
  loading: boolean
  failed: boolean
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p className="mt-2 truncate text-lg font-bold text-primary sm:text-2xl" aria-live="polite">
        {loading ? '…' : failed ? '—' : value}
      </p>
    </div>
  )
}

export function MarketplaceAvailabilitySummary() {
  const availability = useMarketplaceAvailability()
  const format = (value: number) => value.toLocaleString('en-US')

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4" aria-label="إحصائيات المتجر">
      <AvailabilityCard
        label="إجمالي الروبكس المتاح"
        value={`${format(availability.robux)} R$`}
        icon={CoinsIcon}
        loading={availability.isLoading}
        failed={Boolean(availability.error)}
      />
      <AvailabilityCard
        label="البائعون المتاحون"
        value={format(availability.sellers)}
        icon={StoreIcon}
        loading={availability.isLoading}
        failed={Boolean(availability.error)}
      />
    </div>
  )
}

export function DeliveryAvailability({ delivery }: { delivery: DeliveryType }) {
  const availability = useMarketplaceAvailability()
  const value = availability.byDelivery[delivery].toLocaleString('en-US')

  return (
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground" aria-live="polite">
      المتاح لهذا النوع في المتجر:{' '}
      <span className="font-semibold text-primary">
        {availability.isLoading ? '…' : availability.error ? '—' : `${value} R$`}
      </span>
    </p>
  )
}

