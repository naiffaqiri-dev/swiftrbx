import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ShieldCheck, Users, Zap } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { SiteReviews } from '@/components/reviews/site-reviews'
import { buttonVariants } from '@/components/ui/button'
import { HomeReveal } from '@/components/home-reveal'
import { createClient } from '@/lib/supabase/server'
import { CATALOG_CATEGORIES, CATALOG_PATHS } from '@/lib/catalog'

const features = {
  ar: [
    { icon: Zap, title: 'تسليم فوري', desc: 'نُنفّذ طلبك بأسرع وقت ممكن مع متابعة مباشرة حتى الاستلام.' },
    { icon: ShieldCheck, title: 'شراء آمن', desc: 'كل عملية موثّقة وبإشراف فريق الدعم لضمان حقوقك.' },
    { icon: Users, title: 'بائعون موثوقون', desc: 'شبكة موردين مُقيّمين تختار منهم الأنسب لكميتك.' },
  ],
  en: [
    { icon: Zap, title: 'Fast delivery', desc: 'We fulfill your order as quickly as possible and track it until it arrives.' },
    { icon: ShieldCheck, title: 'Secure checkout', desc: 'Every order is documented and monitored by our support team.' },
    { icon: Users, title: 'Trusted sellers', desc: 'Choose the right seller from our network of rated suppliers.' },
  ],
}

type OfferRow = { seller_id: string; available: number | string }

export default async function HomePage() {
  const cookieStore = await cookies()
  const lang = cookieStore.get('swiftrbx.lang')?.value === 'en' ? 'en' : 'ar'
  const copy = lang === 'en'
    ? {
        badge: 'Your trusted Robux store in the Middle East',
        headline: 'Buy Robux quickly and securely',
        intro: 'Choose your quantity and delivery method, pay securely, and let our team handle the rest with live support connecting you to your seller.',
        buy: 'Shop Robux now',
        signup: 'Create account',
        available: 'Robux available now',
        liveSupport: 'Live support',
        activeSeller: 'Active sellers',
        imageAlt: 'SwiftRBX — your trusted Robux store',
        sellersHeading: 'Seller stores',
        categoriesHeading: 'Explore marketplace categories',
        marketLink: 'Robux marketplace',
        categoryLabels: { limited: 'Limiteds', account: 'Roblox accounts', map_item: 'Map items' },
        storesLabel: 'SwiftRBX stores',
      }
    : {
        badge: 'متجرك الأمثل للروبوكس في الشرق الأوسط',
        headline: 'اشترِ الروبوكس بسرعة وأمان',
        intro: 'حدّد الكمية ونوع التسليم، ادفع بأمان، ودع فريقنا يُكمل الباقي مع دعم مباشر يربطك بالبائع لحظة بلحظة.',
        buy: 'اشترِ روبوكس الآن',
        signup: 'إنشاء حساب',
        available: 'روبوكس متاح الآن',
        liveSupport: 'دعم مباشر',
        activeSeller: 'بائع نشط',
        imageAlt: 'SwiftRBX — متجرك الأمثل للروبوكس',
        sellersHeading: 'متاجر البائعين',
        categoriesHeading: 'تصفّح أقسام السوق',
        marketLink: 'سوق الروبوكس',
        categoryLabels: { limited: 'اللميتدز', account: 'حسابات Roblox', map_item: 'أغراض المابات' },
        storesLabel: 'متاجر SwiftRBX',
      }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // المستخدم المسجّل لا يرى واجهة الهبوط الترويجية — نوجّهه للوحته مباشرة
  if (user) {
    redirect('/dashboard')
  }

  const { data: offers } = await supabase.rpc('active_offers')
  const rows = (offers ?? []) as OfferRow[]
  const totalRobux = rows.reduce((sum, o) => sum + Number(o.available ?? 0), 0)
  const activeSellers = new Set(rows.map((o) => o.seller_id)).size

  const stats = [
    { value: totalRobux, label: copy.available },
    { value: '24/7', label: copy.liveSupport },
    { value: activeSellers, label: copy.activeSeller },
  ]
  const pageFeatures = features[lang]

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
            <HomeReveal className="flex flex-col gap-6">
              <span className="w-fit rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                {copy.badge}
              </span>
              <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                {lang === 'en' ? (
                  <>Buy <span className="text-primary">Robux</span> quickly and securely</>
                ) : (
                  <>اشترِ <span className="text-primary">الروبوكس</span> بسرعة وأمان</>
                )}
              </h1>
              <p className="max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
                {copy.intro}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/market"
                  className={buttonVariants({ size: 'lg', className: 'gap-2 shadow-[0_0_28px_-6px_var(--primary)]' })}
                >
                  {copy.buy}
                </Link>
                <Link href="/register" className={buttonVariants({ size: 'lg', variant: 'secondary' })}>
                  {copy.signup}
                </Link>
              </div>
            </HomeReveal>

            <HomeReveal className="relative aspect-video overflow-hidden rounded-3xl ring-1 ring-primary/30 shadow-[0_0_60px_-20px_var(--primary)]" delay={0.12}>
              <Image
                src="/images/swiftrbx-banner.jpg"
                alt={copy.imageAlt}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
              />
            </HomeReveal>
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto w-full max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border/60 bg-card/50 p-6 sm:grid-cols-3">
            {stats.map((s, index) => (
              <HomeReveal key={s.label} delay={index * 0.08} className="flex flex-col items-center gap-1">
                <span className="text-3xl font-extrabold text-primary">
                  {typeof s.value === 'number' ? s.value.toLocaleString('en-US') : s.value}
                </span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </HomeReveal>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-5 sm:grid-cols-3">
            {pageFeatures.map((f, index) => (
              <HomeReveal key={f.title} delay={index * 0.08} className="h-full">
                <div className="flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card/50 p-6 transition-transform duration-300 hover:-translate-y-1">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="text-lg font-bold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground text-pretty">
                    {f.desc}
                  </p>
                </div>
              </HomeReveal>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-primary">{copy.sellersHeading}</p>
              <h2 className="mt-1 text-2xl font-extrabold">{copy.categoriesHeading}</h2>
            </div>
            <Link href="/market" className={buttonVariants({ variant: 'ghost', className: 'gap-2' })}>{copy.marketLink} <span aria-hidden="true">←</span></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {CATALOG_CATEGORIES.map((category, index) => (
              <HomeReveal key={category} delay={index * 0.08} className="h-full">
                <Link href={CATALOG_PATHS[category]} className="group flex min-h-36 h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/40 p-5 transition-colors hover:border-primary/50 hover:bg-card/70">
                  <span className="text-xs font-medium text-muted-foreground">{copy.storesLabel}</span>
                  <span className="flex items-center justify-between gap-3 text-lg font-bold">
                    {copy.categoryLabels[category]}
                    <span className="text-primary transition-transform group-hover:-translate-x-1" aria-hidden="true">←</span>
                  </span>
                </Link>
              </HomeReveal>
            ))}
          </div>
        </section>

        {/* Site reviews */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
            <SiteReviews compact />
        </section>
      </main>

      <SupportButton />
    </div>
  )
}
