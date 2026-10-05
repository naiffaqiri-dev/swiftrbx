'use client'

import useSWR from 'swr'
import { BuyersLeaderboard, type BuyerEntry } from '@/components/buyers-leaderboard'
import { useLocale } from '@/components/i18n/locale-provider'

type LeaderboardData = {
  allTime: BuyerEntry[]
  monthly: BuyerEntry[]
  monthLabel: string
}

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('request_failed')
  return response.json() as Promise<T>
}

export function BuyersPanel() {
  const { t } = useLocale()
  const { data: leaderboard, error } = useSWR<LeaderboardData>('/api/buyers/leaderboard', fetcher)

  if (leaderboard) return <BuyersLeaderboard {...leaderboard} />

  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        {t('buyers.leaderboardError')}
      </p>
    )
  }

  return (
    <section aria-label={t('buyers.title')} className="flex min-h-32 items-center justify-center rounded-2xl border border-border bg-card/40 text-sm text-muted-foreground">
      {t('buyers.loading')}
    </section>
  )
}
