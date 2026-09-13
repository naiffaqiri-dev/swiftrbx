'use client'

import { useMemo, useState } from 'react'
import { useAuth, ROLE_LABELS, type Role, type ManagedUser } from '@/components/auth/mock-auth'
import { DashboardShell, StatCard } from './dashboard-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  LayoutDashboard,
  Store,
  Headphones,
  Users,
  UserPlus,
  Wallet,
  ShieldCheck,
  Trash2,
  CircleDot,
} from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'sellers', label: 'الموردون', icon: <Store className="h-4 w-4" /> },
  { key: 'support', label: 'الدعم الفني', icon: <Headphones className="h-4 w-4" /> },
  { key: 'staff', label: 'إدارة الموظفين', icon: <Users className="h-4 w-4" /> },
]

const ROLE_STYLES: Record<Role, string> = {
  owner: 'bg-primary/20 text-primary',
  seller: 'bg-emerald-500/15 text-emerald-400',
  support: 'bg-sky-500/15 text-sky-400',
  user: 'bg-muted text-muted-foreground',
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <CircleDot className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-muted-foreground/50'}`} />
      {active ? 'نشط' : 'غير نشط'}
    </span>
  )
}

function UserTable({
  rows,
  onToggleActive,
  onChangeRole,
  onRemove,
}: {
  rows: ManagedUser[]
  onToggleActive: (u: ManagedUser) => void
  onChangeRole: (u: ManagedUser, role: Role) => void
  onRemove: (u: ManagedUser) => void
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">لا يوجد سجلات</p>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
      <table className="w-full min-w-[640px] text-right text-sm">
        <thead>
          <tr className="border-b border-border/60 text-xs text-muted-foreground">
            <th className="p-3 font-medium">المستخدم</th>
            <th className="p-3 font-medium">الدور</th>
            <th className="p-3 font-medium">الرصيد</th>
            <th className="p-3 font-medium">الحالة</th>
            <th className="p-3 font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-border/40 last:border-0">
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {u.username.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className="font-medium">{u.username}</div>
                    {u.email && <div className="text-xs text-muted-foreground">{u.email}</div>}
                  </div>
                </div>
              </td>
              <td className="p-3">
                <select
                  value={u.role}
                  onChange={(e) => onChangeRole(u, e.target.value as Role)}
                  disabled={u.role === 'owner'}
                  className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-60"
                >
                  {(['owner', 'seller', 'support', 'user'] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-3 font-medium">{u.balance.toLocaleString()} $</td>
              <td className="p-3">
                <button onClick={() => onToggleActive(u)} disabled={u.role === 'owner'}>
                  <StatusDot active={u.active} />
                </button>
              </td>
              <td className="p-3">
                <button
                  onClick={() => onRemove(u)}
                  disabled={u.role === 'owner'}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive/90 transition-colors hover:bg-destructive/10 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function OwnerPanel() {
  const { users, addStaff, updateUser, removeUser } = useAuth()
  const [active, setActive] = useState('overview')

  const [form, setForm] = useState<{ username: string; email: string; role: Role }>({
    username: '',
    email: '',
    role: 'seller',
  })
  const [staffMsg, setStaffMsg] = useState<
    { type: 'success'; email: string; tempPassword?: string } | { type: 'error'; text: string } | null
  >(null)
  const [submitting, setSubmitting] = useState(false)

  const sellers = useMemo(() => users.filter((u) => u.role === 'seller'), [users])
  const support = useMemo(() => users.filter((u) => u.role === 'support'), [users])
  const activeSellers = sellers.filter((u) => u.active).length
  const activeSupport = support.filter((u) => u.active).length

  const toggleActive = (u: ManagedUser) => updateUser(u.id, { active: !u.active })
  const changeRole = (u: ManagedUser, role: Role) => updateUser(u.id, { role })
  const remove = (u: ManagedUser) => removeUser(u.id)

  const submitStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username.trim() || submitting) return
    setSubmitting(true)
    setStaffMsg(null)
    const result = await addStaff({
      username: form.username,
      email: form.email || undefined,
      role: form.role,
    })
    setSubmitting(false)
    if (result.error) {
      setStaffMsg({ type: 'error', text: result.error })
      return
    }
    setStaffMsg({ type: 'success', email: result.email ?? '', tempPassword: result.tempPassword })
    setForm({ username: '', email: '', role: 'seller' })
  }

  return (
    <DashboardShell title="لوحة الإدارة العليا" nav={NAV} active={active} onNavigate={setActive}>
      {active === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="الموردون النشطون" value={activeSellers} accent icon={<Store className="h-5 w-5" />} />
            <StatCard label="الدعم النشط" value={activeSupport} icon={<Headphones className="h-5 w-5" />} />
            <StatCard label="إجمالي الموظفين" value={sellers.length + support.length} icon={<Users className="h-5 w-5" />} />
            <StatCard
              label="أرصدة الموردين"
              value={`${sellers.reduce((s, u) => s + u.balance, 0).toLocaleString()} $`}
              icon={<Wallet className="h-5 w-5" />}
            />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              الموظفون النشطون حالياً
            </h2>
            <UserTable
              rows={[...sellers, ...support].filter((u) => u.active)}
              onToggleActive={toggleActive}
              onChangeRole={changeRole}
              onRemove={remove}
            />
          </div>
        </div>
      )}

      {active === 'sellers' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground">كل الموردين ({sellers.length})</h2>
          <UserTable rows={sellers} onToggleActive={toggleActive} onChangeRole={changeRole} onRemove={remove} />
        </div>
      )}

      {active === 'support' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground">فريق الدعم الفني ({support.length})</h2>
          <UserTable rows={support} onToggleActive={toggleActive} onChangeRole={changeRole} onRemove={remove} />
        </div>
      )}

      {active === 'staff' && (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={submitStaff}
            className="h-fit space-y-4 rounded-xl border border-border/60 bg-card/40 p-5"
          >
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <UserPlus className="h-4 w-4 text-primary" />
              إضافة موظف جديد
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="s-username">اسم المستخدم</Label>
              <Input
                id="s-username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="مثال: khaled_store"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email">البريد (اختياري)</Label>
              <Input
                id="s-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@swiftrbx.site"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-role">الصلاحية / الدور</Label>
              <select
                id="s-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="seller">بائع / مورد</option>
                <option value="support">دعم فني</option>
                <option value="user">مستخدم</option>
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'جارٍ الإضافة…' : 'إضافة الموظف'}
            </Button>

            {staffMsg?.type === 'error' && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {staffMsg.text}
              </p>
            )}
            {staffMsg?.type === 'success' && (
              <div className="space-y-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs">
                <p className="font-semibold text-primary">تم إنشاء الحساب بنجاح</p>
                <p className="text-muted-foreground">
                  البريد للدخول: <span className="font-mono text-foreground">{staffMsg.email}</span>
                </p>
                {staffMsg.tempPassword && (
                  <p className="text-muted-foreground">
                    كلمة المرور المؤقتة:{' '}
                    <span className="font-mono text-foreground">{staffMsg.tempPassword}</span>
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  شارك هذه البيانات مع الموظف — لن تظهر كلمة المرور مرة أخرى.
                </p>
              </div>
            )}
          </form>

          <div className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground">كل الحسابات ({users.length})</h2>
            <UserTable rows={users} onToggleActive={toggleActive} onChangeRole={changeRole} onRemove={remove} />
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
