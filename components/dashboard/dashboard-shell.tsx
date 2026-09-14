'use client'

import Link from 'next/link'
import { useAuth, ROLE_LABELS } from '@/components/auth/mock-auth'
import { BrandLogo } from '@/components/brand-logo'
import { LogOut, Home, User as UserIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function DashboardShell({
  title,
  nav,
  active,
  onNavigate,
  children,
}: {
  title: string
  nav: { key: string; label: string; icon: ReactNode }[]
  active: string
  onNavigate: (key: string) => void
  children: ReactNode
}) {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-l border-border/60 bg-card/40 p-4 md:flex">
        <div className="mb-6 px-2">
          <BrandLogo />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active === item.key
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-border/60 pt-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            العودة للموقع
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive/90 transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-border/60 bg-card/30 px-5 py-4">
          <div>
            <h1 className="text-lg font-bold text-balance">{title}</h1>
            {user && (
              <p className="text-xs text-muted-foreground">
                {user.username} · {ROLE_LABELS[user.role]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 md:hidden">
              {nav.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  aria-label={item.label}
                  className={`rounded-lg p-2 ${active === item.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}
                >
                  {item.icon}
                </button>
              ))}
            </div>
            <Link
              href="/account"
              aria-label="الملف الشخصي والإعدادات"
              title="الملف الشخصي والإعدادات"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-primary/15 text-sm font-bold text-primary transition-colors hover:border-primary/60 hover:bg-primary/25"
            >
              {user?.username ? (
                user.username.slice(0, 2).toUpperCase()
              ) : (
                <UserIcon className="h-5 w-5" />
              )}
            </Link>
          </div>
        </header>
        <div className="p-5">{children}</div>
      </main>
    </div>
  )
}

export function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string
  value: ReactNode
  accent?: boolean
  icon?: ReactNode
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent ? 'border-primary/40 bg-primary/10' : 'border-border/60 bg-card/40'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className={accent ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
