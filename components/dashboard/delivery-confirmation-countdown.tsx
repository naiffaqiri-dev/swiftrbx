'use client'

import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

type DeliveryConfirmationCountdownProps = {
  deliveredAt: string | null
}

const CONFIRMATION_WINDOW_MS = 30 * 60 * 1000

export function DeliveryConfirmationCountdown({ deliveredAt }: DeliveryConfirmationCountdownProps) {
  const { t } = useLocale()
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    const deliveredTime = deliveredAt ? Date.parse(deliveredAt) : NaN
    if (!Number.isFinite(deliveredTime)) {
      setRemainingMs(null)
      return
    }

    const updateRemaining = () => {
      setRemainingMs(Math.max(0, deliveredTime + CONFIRMATION_WINDOW_MS - Date.now()))
    }

    updateRemaining()
    const interval = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(interval)
  }, [deliveredAt])

  if (!deliveredAt || !Number.isFinite(Date.parse(deliveredAt))) return null

  const isExpired = remainingMs !== null && remainingMs <= 0
  const totalSeconds = Math.ceil((remainingMs ?? CONFIRMATION_WINDOW_MS) / 1000)
  const timeLeft = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`

  return (
    <span
      role="timer"
      aria-label={isExpired ? t('انتهت مهلة التأكيد') : `${t('التأكيد التلقائي خلال')} ${timeLeft}`}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
    >
      <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
      {isExpired ? t('انتهت مهلة التأكيد') : `${t('التأكيد التلقائي خلال')} ${timeLeft}`}
    </span>
  )
}

