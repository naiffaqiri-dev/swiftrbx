import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { ChevronLeft } from 'lucide-react'

export type LegalSection = {
  en: { title: string; body: string }
  ar: { title: string; body: string }
}

export function LegalPage({
  badge,
  titleEn,
  titleAr,
  introEn,
  introAr,
  sections,
}: {
  badge: string
  titleEn: string
  titleAr: string
  introEn: string
  introAr: string
  sections: LegalSection[]
}) {
  return (
    <main className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-background py-12 sm:py-16">
      {/* ambient neon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_60%)] opacity-20 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-4xl px-4">
        <header className="flex flex-col items-center gap-6 text-center">
          <BrandLogo showText={false} className="scale-125" />

          <div>
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              {titleAr} <span className="text-primary drop-shadow-[0_0_12px_var(--primary)]">SwiftRBX</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
              {introAr}
            </p>
          </div>

          <span className="rounded-full border border-primary/40 bg-primary/10 px-5 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary shadow-[0_0_20px_-6px_var(--primary)]">
            {badge}
          </span>
        </header>

        <div className="mt-10 rounded-3xl border border-primary/20 bg-card/40 p-6 shadow-[0_0_40px_-20px_var(--primary)] backdrop-blur sm:p-9">
          <ol className="flex flex-col gap-7">
            {sections.map((section, i) => (
              <li
                key={i}
                className="grid gap-x-8 gap-y-3 border-b border-border/40 pb-7 last:border-none last:pb-0 md:grid-cols-2"
              >
                {/* English */}
                <div dir="ltr" className="text-left">
                  <h2 className="flex items-center gap-2.5 text-base font-bold">
                    <Dot />
                    <span>
                      {i + 1}. {section.en.title}
                    </span>
                  </h2>
                  <p className="mt-1.5 ps-[18px] text-sm leading-relaxed text-muted-foreground">
                    {section.en.body}
                  </p>
                </div>

                {/* Arabic */}
                <div dir="rtl" className="text-right">
                  <h2 className="flex items-center gap-2.5 text-base font-bold">
                    <Dot />
                    <span>
                      {i + 1}. {section.ar.title}
                    </span>
                  </h2>
                  <p className="mt-1.5 pe-[18px] text-sm leading-relaxed text-muted-foreground">
                    {section.ar.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <ChevronLeft className="h-4 w-4" />
            Go back
          </Link>
        </div>
      </div>
    </main>
  )
}

function Dot() {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_2px_var(--primary)]"
    />
  )
}
