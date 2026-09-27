'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth, ROLE_LABELS } from '@/components/auth/mock-auth'
import { LogoutConfirmation } from '@/components/auth/logout-confirmation'
import { BrandLogo } from '@/components/brand-logo'
import { MessageNotifier } from './message-notifier'
import { SupportButton } from '@/components/support-button'
import { LanguageToggle, useLocale } from '@/components/i18n/locale-provider'
import { LogOut, Home, User as UserIcon } from 'lucide-react'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { useReducedMotion } from 'motion/react'
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
  const { t } = useLocale()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] bg-background text-foreground">
      <MessageNotifier />
      <SupportButton />
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
            {t('shell.backToSite')}
          </Link>
          <LogoutConfirmation
            onConfirm={handleLogout}
            trigger={(openDialog) => (
              <button
                type="button"
                onClick={openDialog}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive/90 transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                {t('auth.logout')}
              </button>
            )}
          />
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="border-b border-border/60 bg-card/30 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-balance text-lg font-bold">{title}</h1>
              {user && (
                <p className="truncate text-xs text-muted-foreground">
                  {user.username} · {ROLE_LABELS[user.role]}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageToggle />
              <Link
                href="/account"
                aria-label={t('shell.profile')}
                title={t('shell.profile')}
                className="flex size-10 items-center justify-center rounded-full border border-border/60 bg-primary/15 text-sm font-bold text-primary transition-colors hover:border-primary/60 hover:bg-primary/25"
              >
                {user?.username ? (
                  user.username.slice(0, 2).toUpperCase()
                ) : (
                  <UserIcon className="size-5" />
                )}
              </Link>
            </div>
          </div>
          <nav aria-label={t('shell.navigation')} className="mt-3 grid grid-cols-2 gap-2 md:hidden">
            {nav.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                aria-current={active === item.key ? 'page' : undefined}
                className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-medium leading-5 transition-colors ${active === item.key ? 'bg-primary/15 text-primary' : 'bg-muted/30 text-muted-foreground'}`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="min-w-0">{item.label}</span>
              </button>
            ))}
          </nav>
        </header>
        <div className="min-w-0 p-4 sm:p-5">{children}</div>
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
  const prefersReducedMotion = useReducedMotion()

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
      <div className="text-2xl font-bold">
        {typeof value !== 'number' ? (
          value
        ) : (
          <>
            <span aria-hidden="true">
              {prefersReducedMotion ? (
                value.toLocaleString('en-US')
              ) : (
                <SlidingNumber number={value} fromNumber={0} thousandSeparator="," />
              )}
            </span>
            <span className="sr-only">{value.toLocaleString('en-US')}</span>
          </>
        )}
      </div>
    </div>
  )
}
