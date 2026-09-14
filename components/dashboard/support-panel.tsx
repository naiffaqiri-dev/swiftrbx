'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { createClient } from '@/lib/supabase/client'
import { DashboardShell, StatCard } from './dashboard-shell'
import { TicketsList } from './tickets-list'
import { LayoutDashboard, Ticket, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'tickets', label: 'التذاكر', icon: <Ticket className="h-4 w-4" /> },
]

export function SupportPanel() {
  const { user } = useAuth()
  const [active, setActive] = useState('overview')
  const [counts, setCounts] = useState({ open: 0, disputes: 0, total: 0 })

  const load = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    const [all, open, disputes] = await Promise.all([
      supabase.from('tickets').select('id', { count: 'exact', head: true }).in('type', ['support', 'dispute']),
      supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('type', ['support', 'dispute'])
        .in('status', ['open', 'disputed']),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('type', 'dispute'),
    ])
    setCounts({ open: open.count ?? 0, disputes: disputes.count ?? 0, total: all.count ?? 0 })
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  return (
    <DashboardShell title="لوحة الدعم الفني" nav={NAV} active={active} onNavigate={setActive}>
      {active === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="تذاكر نشطة" value={counts.open} accent icon={<Clock className="h-5 w-5" />} />
          <StatCard label="نزاعات" value={counts.disputes} icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard label="إجمالي التذاكر" value={counts.total} icon={<CheckCircle2 className="h-5 w-5" />} />
        </div>
      )}

      {active === 'tickets' && <TicketsList role="support" />}
    </DashboardShell>
  )
}
