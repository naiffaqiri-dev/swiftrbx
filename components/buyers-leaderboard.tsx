'use client'

import { Trophy } from 'lucide-react'
import { ProfileAvatar } from '@/components/profile-avatar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useLocale } from '@/components/i18n/locale-provider'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export type BuyerEntry = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  totalRobux: number
}

type BuyersLeaderboardProps = {
  allTime: BuyerEntry[]
  monthly: BuyerEntry[]
  monthLabel: string
}

export function BuyersLeaderboard({ allTime, monthly, monthLabel }: BuyersLeaderboardProps) {
  const { lang, t } = useLocale()
  const [period, setPeriod] = useState<'allTime' | 'monthly'>('allTime')
  const entries = period === 'allTime' ? allTime : monthly
  const displayMonthLabel = lang === 'ar'
    ? monthLabel
    : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date())
  const formattedTotal = (amount: number) => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US').format(amount)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-7">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Trophy aria-hidden="true" className="size-4" />
          <span>{t('buyers.eyebrow')}</span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{t('buyers.title')}</h1>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{t('buyers.description')}</p>
        </div>
      </header>

      <section aria-label={t('buyers.category')} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">{period === 'monthly' ? t('buyers.monthLabel') : t('buyers.allTime')}</h2>
            {period === 'monthly' && <p className="text-sm text-muted-foreground">{displayMonthLabel}</p>}
          </div>
          <ToggleGroup
            value={[period]}
            onValueChange={(value) => {
              if (value[0]) setPeriod(value[0] as 'allTime' | 'monthly')
            }}
            variant="outline"
            size="sm"
            aria-label={t('buyers.category')}
            className="w-full sm:w-auto"
          >
            <ToggleGroupItem value="allTime" className="flex-1 sm:flex-none">
              {t('buyers.allTime')}
            </ToggleGroupItem>
            <ToggleGroupItem value="monthly" className="flex-1 sm:flex-none">
              {t('buyers.monthly')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {entries.length > 0 ? (
          <ol aria-label={t('buyers.category')} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
            {entries.map((buyer, index) => (
              <li key={buyer.id} className="flex items-center gap-3 border-b border-border/70 px-3 py-4 last:border-b-0 sm:gap-4 sm:px-5">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')} aria-label={`${t('buyers.rank')} ${index + 1}`}>
                  {index + 1}
                </span>
                <ProfileAvatar
                  src={buyer.avatarUrl}
                  name={buyer.displayName || buyer.username}
                  alt={buyer.displayName || buyer.username}
                  className="size-11"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold">{buyer.displayName}</span>
                  <span className="truncate text-sm text-muted-foreground">@{buyer.username}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-end">
                  <span className="font-bold tabular-nums">{formattedTotal(buyer.totalRobux)}</span>
                  <span className="text-xs text-muted-foreground">R$</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center text-sm leading-relaxed text-muted-foreground">
            {t('buyers.empty')}
          </div>
        )}
      </section>
    </div>
  )
}
