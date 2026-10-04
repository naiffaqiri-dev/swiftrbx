'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Wallet, ShoppingBag, Coins } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BuyersLeaderboard, type BuyerEntry } from '@/components/buyers-leaderboard'
import { useLocale } from '@/components/i18n/locale-provider'
import { StatCard } from '@/components/dashboard/dashboard-shell'
import { formatSar } from '@/lib/currency'

type LeaderboardData = {
  allTime: BuyerEntry[]
  monthly: BuyerEntry[]
  monthLabel: string
}

type AccountStats = {
  purchaseCount: number
  spentSar: number
  robuxReceived: number
}

type Period = 'all' | '1' | '3' | '6' | '12'

const PERIODS: { value: Period; key: string }[] = [
  { value: 'all', key: 'buyers.period.all' },
  { value: '1', key: 'buyers.period.month' },
  { value: '3', key: 'buyers.period.threeMonths' },
  { value: '6', key: 'buyers.period.sixMonths' },
  { value: '12', key: 'buyers.period.year' },
]

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('request_failed')
  return response.json() as Promise<T>
}

export function BuyersPanel() {
  const { t, lang } = useLocale()
  const [period, setPeriod] = useState<Period>('1')
  const { data: leaderboard, error: leaderboardError } = useSWR<LeaderboardData>(
    '/api/buyers/leaderboard', fetcher,
  )
  const { data: stats, error: statsError } = useSWR<AccountStats>(
    `/api/buyers/account-stats?period=${period}`, fetcher,
  )
  const number = (value: number) => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US').format(value)

  return (
    <div className="flex flex-col gap-8">
      {leaderboard ? (
        <BuyersLeaderboard {...leaderboard} />
      ) : leaderboardError ? (
        <p role="alert" className="rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">{t('buyers.leaderboardError')}</p>
      ) : (
        <section aria-label={t('buyers.title')} className="flex min-h-32 items-center justify-center rounded-2xl border border-border bg-card/40 text-sm text-muted-foreground">
          {t('buyers.loading')}
        </section>
      )}

      <Separator />
      <section aria-labelledby="account-stats-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div>
            <h2 id="account-stats-heading" className="text-xl font-bold">{t('buyers.accountStats')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('buyers.accountStatsDescription')}</p>
          </div>
          <ToggleGroup
            value={[period]}
            onValueChange={(value) => {
              if (value[0]) setPeriod(value[0] as Period)
            }}
            variant="outline"
            size="sm"
            aria-label={t('buyers.statsPeriod')}
            className="flex-wrap"
          >
            {PERIODS.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {t(option.key)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {statsError ? (
          <p role="alert" className="rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">{t('buyers.statsError')}</p>
        ) : stats ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={t('buyers.spent')} value={formatSar(stats.spentSar)} icon={<Wallet className="size-5" />} />
            <StatCard label={t('buyers.purchasesCount')} value={stats.purchaseCount} icon={<ShoppingBag className="size-5" />} />
            <StatCard label={t('buyers.robuxReceived')} value={`${number(stats.robuxReceived)} R$`} icon={<Coins className="size-5" />} />
          </div>
        ) : (
          <div className="flex min-h-28 items-center justify-center rounded-xl border border-border bg-card/40 text-sm text-muted-foreground" aria-live="polite">
            {t('buyers.loading')}
          </div>
        )}
        {stats && <p className="text-xs text-muted-foreground">{t('buyers.periodCaption').replace('{period}', t(PERIODS.find((option) => option.value === period)?.key ?? 'buyers.period.month'))}</p>}
      </section>
    </div>
  )
}
