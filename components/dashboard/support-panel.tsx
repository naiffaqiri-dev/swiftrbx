'use client'

import { useState } from 'react'
import { DashboardShell, StatCard } from './dashboard-shell'
import { LayoutDashboard, Ticket, MessageSquare, CheckCircle2, Clock } from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'tickets', label: 'التذاكر', icon: <Ticket className="h-4 w-4" /> },
]

const MOCK_TICKETS = [
  { id: 'T-1042', user: 'khalid', subject: 'استفسار عن طلب روبوكس', status: 'open' as const },
  { id: 'T-1039', user: 'noor', subject: 'مشكلة في التسليم', status: 'open' as const },
  { id: 'T-1035', user: 'faisal', subject: 'طلب استرجاع', status: 'closed' as const },
]

export function SupportPanel() {
  const [active, setActive] = useState('overview')
  const open = MOCK_TICKETS.filter((t) => t.status === 'open').length

  return (
    <DashboardShell title="لوحة الدعم الفني" nav={NAV} active={active} onNavigate={setActive}>
      {active === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="تذاكر نشطة" value={open} accent icon={<Clock className="h-5 w-5" />} />
          <StatCard label="تذاكر مغلقة" value={MOCK_TICKETS.length - open} icon={<CheckCircle2 className="h-5 w-5" />} />
          <StatCard label="إجمالي التذاكر" value={MOCK_TICKETS.length} icon={<Ticket className="h-5 w-5" />} />
        </div>
      )}

      {active === 'tickets' && (
        <div className="space-y-3">
          {MOCK_TICKETS.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">
                    {t.subject} <span className="text-xs text-muted-foreground">#{t.id}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">من: {t.user}</div>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  t.status === 'open' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {t.status === 'open' ? 'مفتوحة' : 'مغلقة'}
              </span>
            </div>
          ))}
          <p className="pt-2 text-center text-xs text-muted-foreground">
            الرد على التذاكر والتزامن مع الديسكورد يُفعّل في مرحلة الربط.
          </p>
        </div>
      )}
    </DashboardShell>
  )
}
