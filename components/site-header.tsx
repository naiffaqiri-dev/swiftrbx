'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, Wallet } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { useAuth, ROLE_LABELS } from '@/components/auth/mock-auth'
import { Button } from '@/components/ui/button'

export function SiteHeader() {
  const { user, ready, logout } = useAuth()
  const router = useRouter()

  function handleLogout() {
    logout()
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <BrandLogo />
        <nav className="flex items-center gap-2">
          {ready && user ? (
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild className="gap-2">
                <Link href="/market">
                  <span className="hidden sm:inline">السوق</span>
                </Link>
              </Button>
              <Button variant="ghost" asChild className="gap-2">
                <Link href="/dashboard">
                  <LayoutDashboard className="size-4" />
                  <span className="hidden sm:inline">لوحة التحكم</span>
                </Link>
              </Button>
              <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                <Wallet className="size-4" />
                {user.balance.toFixed(2)} $
              </span>
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {user.username.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden flex-col leading-tight sm:flex">
                  <span className="text-sm font-semibold">{user.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[user.role]}
                  </span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="تسجيل الخروج"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">تسجيل الدخول</Link>
              </Button>
              <Button asChild className="shadow-[0_0_24px_-6px_var(--primary)]">
                <Link href="/register">إنشاء حساب</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
