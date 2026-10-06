'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useLocale } from '@/components/i18n/locale-provider'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, CircleCheck, CircleDashed, Loader2, RefreshCw, Ticket } from 'lucide-react'

type TicketLog = {
  id: string
  type: string
  subject: string
  status: string
  buyer: string
  seller: string
  order_id: string | null
  quantity: number | null
  delivery_method: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  close_reason: string | null
}

type TicketLogResponse = { logs: TicketLog[]; count: number; page: number; pageSize: number }
type LogFilter = 'all' | 'completed' | 'open'

async function fetchLogs(url: string): Promise<TicketLogResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('تعذّر تحميل سجلات التذاكر')
  return response.json()
}

const FILTERS: { value: LogFilter; label: string }[] = [
  { value: 'all', label: 'كل السجلات' },
  { value: 'completed', label: 'مكتملة' },
  { value: 'open', label: 'غير مكتملة' },
]

export function TicketLogs() {
  const { t, lang } = useLocale()
  const [filter, setFilter] = useState<LogFilter>('all')
  const [page, setPage] = useState(1)
  const key = `/api/admin/ticket-logs?status=${filter}&page=${page}`
  const { data, error, isLoading, mutate } = useSWR<TicketLogResponse>(key, fetchLogs, { refreshInterval: 60_000 })
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / (data?.pageSize ?? 50)))
  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—'

  return (
    <section className="space-y-4" aria-labelledby="ticket-logs-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ticket-logs-heading" className="flex items-center gap-2 text-lg font-bold">
            <Ticket className="size-5 text-primary" />{t('سجلات التذاكر')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('سجل التذاكر المكتملة وغير المكتملة مع تفاصيل الطلب')}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void mutate()} className="gap-2">
          <RefreshCw className="size-4" />{t('تحديث السجل')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('تصفية السجلات')}>
        {FILTERS.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={filter === item.value ? 'default' : 'outline'}
            onClick={() => { setFilter(item.value); setPage(1) }}
          >
            {t(item.label)}
          </Button>
        ))}
        <span className="ms-auto self-center text-sm text-muted-foreground">{data?.count ?? 0} {t('تذكرة')}</span>
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{t('تعذّر تحميل سجلات التذاكر')}</p>}
      {isLoading && !data ? (
        <div className="flex min-h-40 items-center justify-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
      ) : data?.logs.length ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[850px] text-start text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t('رقم التذكرة')}</th>
                  <th className="px-4 py-3 font-semibold">{t('المشتري')}</th>
                  <th className="px-4 py-3 font-semibold">{t('البائع')}</th>
                  <th className="px-4 py-3 font-semibold">{t('نوع الطلب')}</th>
                  <th className="px-4 py-3 font-semibold">{t('الكمية')}</th>
                  <th className="px-4 py-3 font-semibold">{t('الحالة')}</th>
                  <th className="px-4 py-3 font-semibold">{t('تاريخ الإنشاء')}</th>
                  <th className="px-4 py-3 font-semibold">{t('تاريخ الإغلاق')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.logs.map((log) => {
                  const completed = ['completed', 'closed', 'resolved'].includes(log.status)
                  return (
                    <tr key={log.id} className="align-top hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs" title={log.id}>#{log.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">{log.buyer || '—'}</td>
                      <td className="px-4 py-3">{log.seller || '—'}</td>
                      <td className="px-4 py-3">
                        <div>{t(log.type || 'طلب')}</div>
                        {log.delivery_method && <div className="mt-1 text-xs text-muted-foreground">{t(log.delivery_method)}</div>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{log.quantity?.toLocaleString(lang === 'ar' ? 'ar' : 'en') ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${completed ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {completed ? <CircleCheck className="size-3.5" /> : <CircleDashed className="size-3.5" />}
                          {t(log.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground" title={log.close_reason ?? undefined}>{formatDate(log.closed_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              <ChevronLeft className="size-4" />{t('السابق')}
            </Button>
            <span className="text-xs text-muted-foreground">{page} / {pages}</span>
            <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
              {t('التالي')}<ChevronRight className="size-4" />
            </Button>
          </div>
        </>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          <Ticket className="size-5" />{t('لا توجد تذاكر في هذا السجل')}
        </div>
      )}
    </section>
  )
}
