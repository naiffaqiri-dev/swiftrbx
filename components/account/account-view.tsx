'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, ROLE_LABELS, ratingOf } from '@/components/auth/mock-auth'
import { StarDisplay } from '@/components/reviews/star-rating'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User as UserIcon, Shield, Star, Wallet, Copy, Check, KeyRound, Smartphone } from 'lucide-react'

export function AccountView() {
  const router = useRouter()
  const { user, ready, updateUser } = useAuth()
  const [tab, setTab] = useState<'profile' | 'security' | 'affiliate'>('profile')
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [twoFA, setTwoFA] = useState(false)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  useEffect(() => {
    if (user) setEmail(user.email ?? '')
  }, [user])

  if (!ready || !user) {
    return <p className="p-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
  }

  const rating = ratingOf(user)
  const refCode = `SWIFT-${user.username.toUpperCase().slice(0, 6)}`

  function saveProfile() {
    updateUser(user!.id, { email })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function copyRef() {
    navigator.clipboard?.writeText(refCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs = [
    { key: 'profile' as const, label: 'الملف الشخصي', icon: <UserIcon className="h-4 w-4" /> },
    { key: 'security' as const, label: 'الأمان', icon: <Shield className="h-4 w-4" /> },
    { key: 'affiliate' as const, label: 'الإحالة والعمولة', icon: <Wallet className="h-4 w-4" /> },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      {/* رأس البروفايل */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border/60 bg-card/40 p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">
          {user.username.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="text-xl font-bold">{user.username}</h1>
          <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          {user.role === 'seller' && (
            <div className="mt-1 flex items-center gap-2">
              <StarDisplay value={rating.avg} size={14} />
              <span className="text-xs text-muted-foreground">{rating.avg || '—'} ({rating.count})</span>
            </div>
          )}
        </div>
        <div className="ms-auto text-left">
          <div className="text-xs text-muted-foreground">الرصيد</div>
          <div className="text-lg font-bold text-primary">{user.balance.toLocaleString()} $</div>
        </div>
      </div>

      {/* التبويبات */}
      <div className="mb-5 flex gap-2 border-b border-border/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="p-username">اسم المستخدم</Label>
            <Input id="p-username" value={user.username} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-email">البريد الإلكتروني</Label>
            <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <Button onClick={saveProfile} className="gap-2">
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? 'تم الحفظ' : 'حفظ التغييرات'}
          </Button>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <KeyRound className="h-4 w-4 text-primary" />
              تغيير كلمة المرور
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="cur">كلمة المرور الحالية</Label>
              <Input id="cur" type="password" placeholder="••••••••" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new">كلمة المرور الجديدة</Label>
                <Input id="new" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf">تأكيد كلمة المرور</Label>
                <Input id="conf" type="password" placeholder="••••••••" />
              </div>
            </div>
            <Button>تحديث كلمة المرور</Button>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/40 p-6">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">التحقق بخطوتين (2FA)</div>
                <div className="text-xs text-muted-foreground">حماية إضافية لحسابك عند تسجيل الدخول</div>
              </div>
            </div>
            <button
              onClick={() => setTwoFA((v) => !v)}
              aria-pressed={twoFA}
              className={`relative h-6 w-11 rounded-full transition-colors ${twoFA ? 'bg-primary' : 'bg-muted'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${twoFA ? 'left-0.5' : 'left-[22px]'}`}
              />
            </button>
          </div>
        </div>
      )}

      {tab === 'affiliate' && (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="text-sm font-bold">برنامج الإحالة</h2>
          <p className="text-sm text-muted-foreground">
            شارك كود الإحالة واحصل على عمولة من كل عملية شراء يقوم بها من تدعوهم.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-border/60 bg-background px-4 py-2.5 font-mono text-sm">
              {refCode}
            </div>
            <Button variant="secondary" onClick={copyRef} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'تم' : 'نسخ'}
            </Button>
          </div>
          <div className="grid gap-4 pt-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 p-4">
              <div className="text-xs text-muted-foreground">دعوات ناجحة</div>
              <div className="text-xl font-bold">0</div>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <div className="text-xs text-muted-foreground">عمولة محصلة</div>
              <div className="text-xl font-bold text-primary">{(user.commission ?? 0).toLocaleString()} $</div>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <div className="text-xs text-muted-foreground">نسبة العمولة</div>
              <div className="text-xl font-bold">5%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
