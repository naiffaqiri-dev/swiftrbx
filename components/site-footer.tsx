'use client'

import Link from 'next/link'
import { Music2 } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { useLocale } from '@/components/i18n/locale-provider'

const socialLinks = [
  { label: 'TikTok', href: 'https://www.tiktok.com/@swiftrbx.site', icon: 'tiktok' },
  { label: 'Instagram', href: 'https://www.instagram.com/swiftrbx.site/', icon: 'instagram' },
  { label: 'Discord', href: 'https://discord.gg/swiftrbx', icon: 'discord' },
] as const

export function SiteFooter() {
  const { lang } = useLocale()
  const isEnglish = lang === 'en'

  return (
    <footer className="mt-auto w-full border-t border-border/70 bg-background">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-5 px-6 py-4 sm:grid-cols-3 sm:gap-4">
        <BrandLogo className="justify-self-center sm:justify-self-start" />

        <nav
          aria-label={isEnglish ? 'Social media' : 'وسائل التواصل الاجتماعي'}
          dir="ltr"
          className="flex items-center justify-center gap-3"
        >
          {socialLinks.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className="flex size-10 items-center justify-center rounded-full border border-border/70 bg-card/50 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {icon === 'tiktok' ? (
                <Music2 className="size-5" aria-hidden="true" />
              ) : icon === 'instagram' ? (
                <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                  <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.14 0-3.51.01-4.75.07-1.15.05-1.77.24-2.18.4-.55.22-.94.47-1.35.88-.41.41-.66.8-.88 1.35-.16.41-.35 1.03-.4 2.18-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.05 1.15.24 1.77.4 2.18.22.55.47.94.88 1.35.41.41.8.66 1.35.88.41.16 1.03.35 2.18.4 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c1.15-.05 1.77-.24 2.18-.4.55-.22.94-.47 1.35-.88.41-.41.66-.8.88-1.35.16-.41.35-1.03.4-2.18.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.05-1.15-.24-1.77-.4-2.18a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.18-.4-1.24-.06-1.61-.07-4.75-.07Zm0 2.76a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 8.74a3.44 3.44 0 1 0 0-6.88 3.44 3.44 0 0 0 0 6.88Zm6.74-8.94a1.24 1.24 0 1 1-2.48 0 1.24 1.24 0 0 1 2.48 0Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                  <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5a13.7 13.7 0 0 1 4.34 2.2 13.5 13.5 0 0 0-11.02 0A13.7 13.7 0 0 1 12.82 3.5L12.58 3A19.8 19.8 0 0 0 7.7 4.4C4.6 9 3.77 13.5 4.18 17.9a19.9 19.9 0 0 0 6.04 3.05l.48-.66a13 13 0 0 1-2.06-.98l.5-.38a14.2 14.2 0 0 0 11.72 0l.5.38c-.65.38-1.34.71-2.06.98l.48.66a19.9 19.9 0 0 0 6.05-3.05c.48-5.11-.82-9.57-3.53-13.5ZM9.68 15.2c-1.18 0-2.15-1.08-2.15-2.4s.95-2.41 2.15-2.41 2.17 1.09 2.15 2.41c0 1.32-.96 2.4-2.15 2.4Zm5.28 0c-1.18 0-2.15-1.08-2.15-2.4s.95-2.41 2.15-2.41 2.17 1.09 2.15 2.41c0 1.32-.95 2.4-2.15 2.4Z" />
                </svg>
              )}
            </a>
          ))}
        </nav>

        <p className="text-center text-sm text-muted-foreground sm:justify-self-end sm:text-start">
          © {new Date().getFullYear()} SwiftRBX. {isEnglish ? 'All rights reserved.' : 'جميع الحقوق محفوظة.'}
        </p>
      </div>

      <nav
        aria-label={isEnglish ? 'Legal links' : 'روابط السياسات'}
        className="flex min-h-14 flex-wrap items-center justify-center gap-3 border-t border-border/60 px-4 py-2"
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
