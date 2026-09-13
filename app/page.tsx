import Image from 'next/image'
import Link from 'next/link'
import { Music2, ShieldCheck, Users, Zap } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: Zap,
    title: 'تسليم فوري',
    desc: 'نُنفّذ طلبك بأسرع وقت ممكن مع متابعة مباشرة حتى الاستلام.',
  },
  {
    icon: ShieldCheck,
    title: 'شراء آمن',
    desc: 'كل عملية موثّقة وبإشراف فريق الدعم لضمان حقوقك.',
  },
  {
    icon: Users,
    title: 'بائعون موثوقون',
    desc: 'شبكة موردين مُقيّمين تختار منهم الأنسب لكميتك.',
  },
]

const stats = [
  { value: '619,615', label: 'روبكس متاح الآن' },
  { value: '24/7', label: 'دعم مباشر' },
  { value: '+50', label: 'بائع نشط' },
]

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
            <div className="flex flex-col gap-6">
              <span className="w-fit rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                متجرك الأمثل للروبكس في الشرق الأوسط
              </span>
              <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                اشترِ <span className="text-primary">الروبكس</span> بسرعة وأمان
              </h1>
              <p className="max-w-md text-pretty text-lg text-muted-foreground">
                حدّد الكمية ونوع التسليم، ادفع بأمان، ودع فريقنا يُكمل الباقي مع
                دعم مباشر يربطك بالبائع لحظة بلحظة.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  asChild
                  className="gap-2 shadow-[0_0_28px_-6px_var(--primary)]"
                >
                  <Link href="/register">ابدأ الآن</Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/login">لديّ حساب</Link>
                </Button>
              </div>
            </div>

            <div className="relative aspect-video overflow-hidden rounded-3xl ring-1 ring-primary/30 shadow-[0_0_60px_-20px_var(--primary)]">
              <Image
                src="/images/swiftrbx-banner.jpg"
                alt="SwiftRBX — متجرك الأمثل للروبكس"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
              />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto w-full max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border/60 bg-card/50 p-6 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <span className="text-3xl font-extrabold text-primary">
                  {s.value}
                </span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-5 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/50 p-6"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="text-sm text-muted-foreground text-pretty">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <BrandLogo />
          <div className="flex items-center gap-3">
            <SocialIcon label="Discord">
              <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5a13.7 13.7 0 0 1 4.34 2.2 13.5 13.5 0 0 0-11.02 0A13.7 13.7 0 0 1 12.82 3.5L12.58 3A19.8 19.8 0 0 0 7.7 4.4C4.6 9 3.77 13.5 4.18 17.9a19.9 19.9 0 0 0 6.04 3.05l.48-.66a13 13 0 0 1-2.06-.98l.5-.38a14.2 14.2 0 0 0 11.72 0l.5.38c-.65.38-1.34.71-2.06.98l.48.66a19.9 19.9 0 0 0 6.05-3.05c.48-5.11-.82-9.57-3.53-13.5ZM9.68 15.2c-1.18 0-2.15-1.08-2.15-2.4s.95-2.41 2.15-2.41 2.17 1.09 2.15 2.41c0 1.32-.96 2.4-2.15 2.4Zm5.28 0c-1.18 0-2.15-1.08-2.15-2.4s.95-2.41 2.15-2.41 2.17 1.09 2.15 2.41c0 1.32-.95 2.4-2.15 2.4Z" />
              </svg>
            </SocialIcon>
            <SocialIcon label="Instagram">
              <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.14 0-3.51.01-4.75.07-1.15.05-1.77.24-2.18.4-.55.22-.94.47-1.35.88-.41.41-.66.8-.88 1.35-.16.41-.35 1.03-.4 2.18-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.05 1.15.24 1.77.4 2.18.22.55.47.94.88 1.35.41.41.8.66 1.35.88.41.16 1.03.35 2.18.4 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c1.15-.05 1.77-.24 2.18-.4.55-.22.94-.47 1.35-.88.41-.41.66-.8.88-1.35.16-.41.35-1.03.4-2.18.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.05-1.15-.24-1.77-.4-2.18a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.18-.4-1.24-.06-1.61-.07-4.75-.07Zm0 2.76a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 8.74a3.44 3.44 0 1 0 0-6.88 3.44 3.44 0 0 0 0 6.88Zm6.74-8.94a1.24 1.24 0 1 1-2.48 0 1.24 1.24 0 0 1 2.48 0Z" />
              </svg>
            </SocialIcon>
            <SocialIcon label="TikTok">
              <Music2 className="size-5" />
            </SocialIcon>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SwiftRBX. جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>

      <SupportButton />
    </div>
  )
}

function SocialIcon({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href="#"
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-card/50 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      {children}
    </a>
  )
}
