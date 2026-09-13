'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { DashboardShell, StatCard } from './dashboard-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LayoutDashboard, Package, Wallet, CheckCircle2, TrendingUp } from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'stock', label: 'المخزون والحدود', icon: <Package className="h-4 w-4" /> },
  { key: 'wallet', label: 'المحفظة', icon: <Wallet className="h-4 w-4" /> },
]

export function SellerPanel() {
  const { user } = useAuth()
  const [active, setActive] = useState('overview')
  const [stock, setStock] = useState({ available: 50000, min: 1000, max: 20000 })

  return (
    <DashboardShell title="لوحة المورد" nav={NAV} active={active} onNavigate={setActive}>
      {active === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="الرصيد الحالي" value={`${(user?.balance ?? 0).toLocaleString()} $`} accent icon={<Wallet className="h-5 w-5" />} />
          <StatCard label="عمليات ناجحة" value={0} icon={<CheckCircle2 className="h-5 w-5" />} />
          <StatCard label="المبالغ المحصلة" value="0 $" icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard label="روبوكس متاح" value={stock.available.toLocaleString()} icon={<Package className="h-5 w-5" />} />
        </div>
      )}

      {active === 'stock' && (
        <div className="max-w-md space-y-4 rounded-xl border border-border/60 bg-card/40 p-5">
          <h2 className="text-sm font-bold">تحديد المخزون وحدود الشراء</h2>
          <p className="text-xs text-muted-foreground">
            يفرز الموقع الموردين تلقائياً حسب هذه القيم عند طلب المشتري لكمية معينة.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="av">الكمية المتاحة (R$)</Label>
            <Input id="av" type="number" value={stock.available} onChange={(e) => setStock((s) => ({ ...s, available: +e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mn">الحد الأدنى</Label>
              <Input id="mn" type="number" value={stock.min} onChange={(e) => setStock((s) => ({ ...s, min: +e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mx">الحد الأقصى</Label>
              <Input id="mx" type="number" value={stock.max} onChange={(e) => setStock((s) => ({ ...s, max: +e.target.value }))} />
            </div>
          </div>
          <Button className="w-full">حفظ الإعدادات</Button>
        </div>
      )}

      {active === 'wallet' && (
        <div className="max-w-md space-y-4 rounded-xl border border-border/60 bg-card/40 p-5">
          <div className="text-sm text-muted-foreground">الرصيد المتاح للسحب</div>
          <div className="text-3xl font-bold text-primary">{(user?.balance ?? 0).toLocaleString()} $</div>
          <Button className="w-full">طلب سحب الأموال</Button>
          <p className="text-xs text-muted-foreground">
            يفتح زر السحب تذكرة خاصة بينك وبين الإدارة العليا لتأكيد الإرسال.
          </p>
        </div>
      )}
    </DashboardShell>
  )
}
