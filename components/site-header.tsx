'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, Trophy, Wallet, Ticket } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { ProfileAvatar } from '@/components/profile-avatar'
import { LogoutConfirmation } from '@/components/auth/logout-confirmation'
import { useAuth, ROLE_LABELS } from '@/components/auth/mock-auth'
import { Button, buttonVariants } from '@/components/ui/button'
import { LanguageToggle, useLocale } from '@/components/i18n/locale-provider'
import { CATALOG_CATEGORIES, CATALOG_PATHS } from '@/lib/catalog'

export function SiteHeader() {
  const { user, ready, logout } = useAuth()
  const { t } = useLocale()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between sm:px-6 sm:py-4">
        <BrandLogo />
        <nav className="flex w-full flex-wrap items-center justify-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
          <Link href="/buyers" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1.5 px-2' })}>
            <Trophy className="size-4" />
            <span>{t('nav.buyers')}</span>
          </Link>
          {ready && user ? (
            <div className="flex w-full flex-wrap items-center justify-center gap-1 sm:w-auto sm:justify-end sm:gap-3">
              <LanguageToggle />
              <Link href="/market" className={buttonVariants({ variant: 'ghost', className: 'gap-2' })}>
                <span className="hidden sm:inline">{t('nav.market')}</span>
              </Link>
              {CATALOG_CATEGORIES.map((category) => (
                <Link key={category} href={CATALOG_PATHS[category]} className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'px-2 text-xs' })}>
                  {t(`nav.category.${category}`)}
                </Link>
              ))}
              <Link href="/tickets" className={buttonVariants({ variant: 'ghost', className: 'gap-2' })}>
                <Ticket className="size-4" />
                <span className="hidden sm:inline">{t('nav.tickets')}</span>
              </Link>
              <Link href="/dashboard" className={buttonVariants({ variant: 'ghost', className: 'gap-2' })}>
                <LayoutDashboard className="size-4" />
                <span className="hidden sm:inline">{t('nav.dashboard')}</span>
              </Link>
              <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                <Wallet className="size-4" />
                {user.balance.toFixed(2)} $
              </span>
              <Link href="/account" className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80">
                <ProfileAvatar
                  src={user.avatarUrl}
                  name={user.displayName ?? user.username}
                  className="size-9"
                />
                <span className="hidden flex-col leading-tight sm:flex">
                  <span className="text-sm font-semibold">{user.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(ROLE_LABELS[user.role])}
                  </span>
                </span>
              </Link>
              <LogoutConfirmation
                onConfirm={handleLogout}
                trigger={(openDialog) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={openDialog}
                    aria-label={t('auth.logout')}
                    title={t('auth.logout')}
                  >
                    <LogOut className="size-4" />
                  </Button>
                )}
              />
            </div>
          ) : (
            <>
              <LanguageToggle />
              {CATALOG_CATEGORIES.map((category) => (
                <Link key={category} href={CATALOG_PATHS[category]} className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'px-2 text-xs' })}>
                  {t(`nav.category.${category}`)}
                </Link>
              ))}
              <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
                {t('auth.login')}
              </Link>
              <Link href="/register" className={buttonVariants({ className: 'shadow-[0_0_24px_-6px_var(--primary)]' })}>
                {t('auth.register')}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
