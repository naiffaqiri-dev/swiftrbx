import { Analytics } from '@vercel/analytics/next'
import { cookies } from 'next/headers'
import type { Metadata, Viewport } from 'next'
import { Cairo } from 'next/font/google'
import { AuthProvider } from '@/components/auth/mock-auth'
import { TicketsProvider } from '@/components/tickets/tickets-provider'
import { LocaleProvider } from '@/components/i18n/locale-provider'
import { SiteFooter } from '@/components/site-footer'
import './globals.css'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
})

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const isEnglish = cookieStore.get('swiftrbx.lang')?.value === 'en'

  return {
    title: isEnglish ? 'SwiftRBX | The trusted Robux store' : 'SwiftRBX | متجر الروبكس الأول',
    description: isEnglish
      ? 'Buy Robux quickly and securely in the Middle East. Fast delivery and live support.'
      : 'SwiftRBX — متجرك الأمثل لشراء الروبكس بسرعة وأمان في الشرق الأوسط. تسليم فوري ودعم مباشر.',
    generator: 'v0.app',
  }
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0a1f14',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const initialLang = cookieStore.get('swiftrbx.lang')?.value === 'en' ? 'en' : 'ar'
  const initialDir = initialLang === 'ar' ? 'rtl' : 'ltr'

  return (
    <html lang={initialLang} dir={initialDir} className={`dark ${cairo.variable} bg-background`}>
      <body className="flex min-h-svh flex-col font-sans antialiased">
        <LocaleProvider initialLang={initialLang}>
          <div className="h-[calc(100svh-3.5rem)] w-full overflow-y-auto">
            <AuthProvider>
              <TicketsProvider>{children}</TicketsProvider>
            </AuthProvider>
          </div>
          <SiteFooter />
        </LocaleProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
