'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type Lang = 'ar' | 'en'

type Dict = Record<string, { ar: string; en: string }>

// Shared chrome + navigation strings. Body copy stays in Arabic; this covers
// the parts of every interface that frame the experience.
const DICT: Dict = {
  'nav.market': { ar: 'السوق', en: 'Market' },
  'nav.tickets': { ar: 'التذاكر', en: 'Tickets' },
  'nav.dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
  'auth.login': { ar: 'تسجيل الدخول', en: 'Sign in' },
  'auth.register': { ar: 'إنشاء حساب', en: 'Sign up' },
  'auth.logout': { ar: 'تسجيل الخروج', en: 'Sign out' },
  'shell.backToSite': { ar: 'العودة للموقع', en: 'Back to site' },
  'shell.profile': { ar: 'الملف الشخصي والإعدادات', en: 'Profile & settings' },
  'support.button': { ar: 'الدعم المباشر', en: 'Live support' },
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

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar')

  useEffect(() => {
    const stored = (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)) as Lang | null
    if (stored === 'ar' || stored === 'en') setLangState(stored)
  }, [])

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }, [lang])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const toggle = useCallback(() => setLangState((l) => (l === 'ar' ? 'en' : 'ar')), [])
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
