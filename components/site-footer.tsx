'use client'

import Link from 'next/link'
import { useLocale } from '@/components/i18n/locale-provider'

export function SiteFooter() {
  const { lang } = useLocale()
  const isEnglish = lang === 'en'

  return (
    <footer className="mt-auto w-full border-t border-border/70 bg-background/95">
      <nav
        aria-label={isEnglish ? 'Legal links' : 'روابط السياسات'}
        className="mx-auto flex min-h-14 items-center justify-center gap-8 px-4 py-3"
      >
        <Link
          href="/policy"
          className="inline-flex min-h-9 items-center rounded-md border border-border/70 bg-card/70 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {isEnglish ? 'Privacy Policy' : 'سياسة الخصوصية'}
        </Link>
        <Link
          href="/terms"
          className="inline-flex min-h-9 items-center rounded-md border border-border/70 bg-card/70 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {isEnglish ? 'Terms of Use' : 'شروط الاستخدام'}
        </Link>
      </nav>
    </footer>
  )
}
