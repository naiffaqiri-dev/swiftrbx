'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTickets } from '@/components/tickets/tickets-provider'
import { DashboardShell, StatCard } from './dashboard-shell'
import { LayoutDashboard, Ticket, MessageSquare, CheckCircle2, Clock, Store, User as UserIcon } from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'tickets', label: 'التذاكر', icon: <Ticket className="h-4 w-4" /> },
]

export function SupportPanel() {
  const router = useRouter()
  const { tickets } = useTickets()
  const [active, setActive] = useState('overview')
  const open = tickets.filter((t) => t.status === 'open').length

  return (
    <DashboardShell title="لوحة الدعم الفني" nav={NAV} active={active} onNavigate={setActive}>
      {active === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="تذاكر نشطة" value={open} accent icon={<Clock className="h-5 w-5" />} />
          <StatCard label="تذاكر مغلقة" value={tickets.length - open} icon={<CheckCircle2 className="h-5 w-5" />} />
          <StatCard label="إجمالي التذاكر" value={tickets.length} icon={<Ticket className="h-5 w-5" />} />
        </div>
      )}

      {active === 'tickets' && (
        <div className="space-y-3">
          {tickets.length === 0 && (
            <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
              لا توجد تذاكر.
            </p>
          )}
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/tickets/${t.id}`)}
              className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4 text-right transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">
                    {t.subject} <span className="text-xs text-muted-foreground">#{t.id}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UserIcon className="h-3 w-3" /> {t.buyer}
                    </span>
                    <span className="flex items-center gap-1">
                      <Store className="h-3 w-3" /> {t.seller}
                    </span>
                  </div>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  t.status === 'open' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {t.status === 'open' ? 'مفتوحة' : 'مغلقة'}
              </span>
            </button>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}
