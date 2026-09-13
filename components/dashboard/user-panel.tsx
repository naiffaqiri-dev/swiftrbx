'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/mock-auth'
import { DashboardShell, StatCard } from './dashboard-shell'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, ShoppingBag, Ticket, Wallet } from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'orders', label: 'طلباتي', icon: <ShoppingBag className="h-4 w-4" /> },
]

export function UserPanel() {
  const { user } = useAuth()
  const [active, setActive] = useState('overview')

  return (
    <DashboardShell title="لوحتي" nav={NAV} active={active} onNavigate={setActive}>
      {active === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="رصيدي" value={`${(user?.balance ?? 0).toLocaleString()} $`} accent icon={<Wallet className="h-5 w-5" />} />
            <StatCard label="عدد المشتريات" value={0} icon={<ShoppingBag className="h-5 w-5" />} />
            <StatCard label="تذاكري" value={0} icon={<Ticket className="h-5 w-5" />} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">ابدأ أول عملية شراء روبوكس الآن</p>
            <Button asChild>
              <Link href="/market">اشترِ روبوكس</Link>
            </Button>
          </div>
        </div>
      )}

      {active === 'orders' && (
        <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          لا توجد طلبات بعد.
        </p>
      )}
    </DashboardShell>
  )
}
