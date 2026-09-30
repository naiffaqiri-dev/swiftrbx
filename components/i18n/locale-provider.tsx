'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type Lang = 'ar' | 'en'

type Dict = Record<string, { ar: string; en: string }>

// Shared navigation and interface strings used across pages.
const DICT: Dict = {
  'nav.market': { ar: 'السوق', en: 'Market' },
  'nav.category.limited': { ar: 'اللميتدز', en: 'Limiteds' },
  'nav.category.account': { ar: 'حسابات Roblox', en: 'Roblox accounts' },
  'nav.category.map_item': { ar: 'أغراض المابات', en: 'Map items' },
  'nav.tickets': { ar: 'التذاكر', en: 'Tickets' },
  'nav.dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
  'auth.login': { ar: 'تسجيل الدخول', en: 'Sign in' },
  'auth.register': { ar: 'إنشاء حساب', en: 'Sign up' },
  'auth.logout': { ar: 'تسجيل الخروج', en: 'Sign out' },
  'auth.logout.confirmTitle': { ar: 'تأكيد تسجيل الخروج', en: 'Confirm sign out' },
  'auth.logout.confirmMessage': { ar: 'هل أنت متأكد أنك تريد تسجيل الخروج؟', en: 'Are you sure you want to sign out?' },
  'auth.logout.failed': { ar: 'تعذّر تسجيل الخروج. حاول مرة أخرى.', en: 'Sign out failed. Please try again.' },
  'common.yes': { ar: 'نعم', en: 'YES' },
  'common.no': { ar: 'لا', en: 'NO' },
  'common.pleaseWait': { ar: 'يرجى الانتظار…', en: 'Please wait…' },
  'shell.backToSite': { ar: 'العودة للموقع', en: 'Back to site' },
  'shell.navigation': { ar: 'التنقل في لوحة التحكم', en: 'Dashboard navigation' },
  'shell.profile': { ar: 'الملف الشخصي والإعدادات', en: 'Profile & settings' },
  'support.button': { ar: 'الدعم المباشر', en: 'Live support' },
  'support.close': { ar: 'إغلاق', en: 'Close' },
  'support.sent': { ar: 'تم إرسال رسالتك', en: 'Your message was sent' },
  'support.sentMessage': { ar: 'سيتواصل معك فريق الدعم في أقرب وقت.', en: 'Our support team will get back to you soon.' },
  'support.done': { ar: 'تم', en: 'Done' },
  'support.prompt': { ar: 'اكتب استفسارك وسيصل مباشرةً إلى فريق الدعم على الديسكورد.', en: 'Send your question directly to our support team on Discord.' },
  'support.message': { ar: 'رسالتك', en: 'Message' },
  'support.messagePlaceholder': { ar: 'كيف يمكننا مساعدتك؟', en: 'How can we help?' },
  'support.contact': { ar: 'وسيلة تواصل (اختياري)', en: 'Contact method (optional)' },
  'support.contactPlaceholder': { ar: 'ديسكورد / بريد / رقم', en: 'Discord / email / phone' },
  'support.send': { ar: 'إرسال', en: 'Send' },
  'support.errorMessage': { ar: 'يرجى كتابة رسالتك أولاً', en: 'Please enter a message first.' },
  'support.errorSend': { ar: 'تعذّر إرسال الرسالة، حاول مرة أخرى.', en: 'Could not send your message. Please try again.' },
  'seller.overview': { ar: 'نظرة عامة', en: 'Overview' },
  'seller.orders': { ar: 'التذاكر النشطة', en: 'Active tickets' },
  'seller.stock': { ar: 'عرض البيع', en: 'Sale offer' },
  'seller.wallet': { ar: 'المحفظة والعمولة', en: 'Wallet & commission' },
}

type Ctx = {
  lang: Lang
  dir: 'rtl' | 'ltr'
  t: (key: string) => string
  toggle: () => void
  setLang: (l: Lang) => void
}

const LocaleContext = createContext<Ctx | null>(null)

const STORAGE_KEY = 'swiftrbx.lang'

export function LocaleProvider({
  children,
  initialLang,
}: {
  children: ReactNode
  initialLang: Lang
}) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const router = useRouter()

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const setLang = useCallback((nextLang: Lang) => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${STORAGE_KEY}=${nextLang}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
    setLangState(nextLang)
    router.refresh()
  }, [router])
  const toggle = useCallback(() => setLang(lang === 'ar' ? 'en' : 'ar'), [lang, setLang])
  const t = useCallback((key: string) => DICT[key]?.[lang] ?? key, [lang])

  return (
    <LocaleContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t, toggle, setLang }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, toggle } = useLocale()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      className={`gap-1.5 ${className ?? ''}`}
    >
      <Languages className="size-4" />
      <span className="text-xs font-bold">{lang === 'ar' ? 'EN' : 'ع'}</span>
    </Button>
  )
}
