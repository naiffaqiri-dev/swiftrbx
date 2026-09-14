'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, ROLE_LABELS, ratingOf } from '@/components/auth/mock-auth'
import { createClient } from '@/lib/supabase/client'
import { StarDisplay } from '@/components/reviews/star-rating'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User as UserIcon, Shield, Wallet, Copy, Check, KeyRound, Smartphone, Loader2, Mail } from 'lucide-react'

function fallbackRef(seed: string) {
  let out = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  for (let i = 0; i < 15; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    out += chars[h % chars.length]
  }
  return out
}

export function AccountView() {
  const router = useRouter()
  const { user, ready, updateUser } = useAuth()
  const [tab, setTab] = useState<'profile' | 'security' | 'affiliate'>('profile')
  const [copied, setCopied] = useState(false)

  // تغيير البريد
  const [newEmail, setNewEmail] = useState('')
  const [emailStage, setEmailStage] = useState<'idle' | 'code'>('idle')
  const [emailCode, setEmailCode] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // كلمة المرور
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // التحقق بخطوتين
  const [twoFA, setTwoFA] = useState(false)
  const [faStage, setFaStage] = useState<'idle' | 'code'>('idle')
  const [faTarget, setFaTarget] = useState(false)
  const [faCode, setFaCode] = useState('')
  const [faBusy, setFaBusy] = useState(false)
  const [faMsg, setFaMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  useEffect(() => {
    if (user) setTwoFA(!!user.twoFactorEnabled)
  }, [user])

  if (!ready || !user) {
    return <p className="p-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
  }

  const rating = ratingOf(user)
  const refCode = user.referralCode && user.referralCode.length === 15 ? user.referralCode : fallbackRef(user.id)

  function copyRef() {
    navigator.clipboard?.writeText(refCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function requestEmailChange() {
    setEmailMsg(null)
    setEmailBusy(true)
    try {
      const res = await fetch('/api/account/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', newEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEmailMsg({ type: 'err', text: data.error ?? 'تعذّر الإرسال' })
        return
      }
      setEmailStage('code')
      setEmailMsg({ type: 'ok', text: 'أرسلنا رمز التحقق إلى البريد الجديد.' })
    } catch {
      setEmailMsg({ type: 'err', text: 'تعذّر الاتصال، حاول لاحقاً' })
    } finally {
      setEmailBusy(false)
    }
  }

  async function confirmEmailChange() {
    setEmailMsg(null)
    setEmailBusy(true)
    try {
      const res = await fetch('/api/account/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', code: emailCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEmailMsg({ type: 'err', text: data.error ?? 'رمز غير صحيح' })
        return
      }
      updateUser(user!.id, { email: data.email })
      setEmailStage('idle')
      setEmailCode('')
      setNewEmail('')
      setEmailMsg({ type: 'ok', text: 'تم تحديث بريدك الإلكتروني بنجاح.' })
    } catch {
      setEmailMsg({ type: 'err', text: 'تعذّر الاتصال، حاول لاحقاً' })
    } finally {
      setEmailBusy(false)
    }
  }

  async function updatePassword() {
    setPwMsg(null)
    if (pw.next.length < 6) {
      setPwMsg({ type: 'err', text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })
      return
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ type: 'err', text: 'كلمتا المرور غير متطابقتين' })
      return
    }
    setPwBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: pw.next })
      if (error) {
        setPwMsg({ type: 'err', text: 'تعذّر تحديث كلمة المرور' })
        return
      }
      setPw({ next: '', confirm: '' })
      setPwMsg({ type: 'ok', text: 'تم تحديث كلمة المرور بنجاح.' })
    } finally {
      setPwBusy(false)
    }
  }

  async function requestTwoFA(enable: boolean) {
    setFaMsg(null)
    setFaTarget(enable)
    setFaBusy(true)
    try {
      const res = await fetch('/api/account/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', enable }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFaMsg({ type: 'err', text: data.error ?? 'تعذّر الإرسال' })
        return
      }
      setFaStage('code')
      setFaMsg({ type: 'ok', text: 'أرسلنا رمز التحقق إلى بريدك.' })
    } catch {
      setFaMsg({ type: 'err', text: 'تعذّر الاتصال، حاول لاحقاً' })
    } finally {
      setFaBusy(false)
    }
  }

  async function confirmTwoFA() {
    setFaMsg(null)
    setFaBusy(true)
    try {
      const res = await fetch('/api/account/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', enable: faTarget, code: faCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFaMsg({ type: 'err', text: data.error ?? 'رمز غير صحيح' })
        return
      }
      setTwoFA(!!data.enabled)
      updateUser(user!.id, { twoFactorEnabled: !!data.enabled })
      setFaStage('idle')
      setFaCode('')
      setFaMsg({ type: 'ok', text: data.enabled ? 'تم تفعيل التحقق بخطوتين.' : 'تم تعطيل التحقق بخطوتين.' })
    } catch {
      setFaMsg({ type: 'err', text: 'تعذّر الاتصال، حاول لاحقاً' })
    } finally {
      setFaBusy(false)
    }
  }

  const tabs = [
    { key: 'profile' as const, label: 'الملف الشخصي', icon: <UserIcon className="h-4 w-4" /> },
    { key: 'security' as const, label: 'الأمان', icon: <Shield className="h-4 w-4" /> },
    { key: 'affiliate' as const, label: 'الإحالة والعمولة', icon: <Wallet className="h-4 w-4" /> },
  ]

  return (
    <div className="mx-auto max-w-3xl">
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

      <div className="mb-5 flex gap-2 border-b border-border/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-5 rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="p-username">اسم المستخدم</Label>
            <Input id="p-username" value={user.username} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>البريد الإلكتروني الحالي</Label>
            <Input value={user.email ?? ''} disabled />
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Mail className="h-4 w-4 text-primary" />
              تغيير البريد الإلكتروني
            </h3>
            {emailStage === 'idle' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="new-email">البريد الجديد</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
                <Button onClick={requestEmailChange} disabled={emailBusy || !newEmail} className="gap-2">
                  {emailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  إرسال رمز التحقق
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email-code">رمز التحقق المرسل إلى البريد الجديد</Label>
                  <Input
                    id="email-code"
                    inputMode="numeric"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    placeholder="000000"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmEmailChange} disabled={emailBusy || !emailCode} className="gap-2">
                    {emailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    تأكيد
                  </Button>
                  <Button variant="ghost" onClick={() => setEmailStage('idle')}>
                    إلغاء
                  </Button>
                </div>
              </>
            )}
            {emailMsg && (
              <p className={`text-xs ${emailMsg.type === 'ok' ? 'text-primary' : 'text-destructive'}`}>{emailMsg.text}</p>
            )}
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <KeyRound className="h-4 w-4 text-primary" />
              تغيير كلمة المرور
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new">كلمة المرور الجديدة</Label>
                <Input id="new" type="password" value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf">تأكيد كلمة المرور</Label>
                <Input id="conf" type="password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
            {pwMsg && <p className={`text-xs ${pwMsg.type === 'ok' ? 'text-primary' : 'text-destructive'}`}>{pwMsg.text}</p>}
            <Button onClick={updatePassword} disabled={pwBusy} className="gap-2">
              {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              تحديث كلمة المرور
            </Button>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">التحقق بخطوتين (2FA)</div>
                  <div className="text-xs text-muted-foreground">حماية إضافية عبر رمز يُرسل إلى بريدك</div>
                </div>
              </div>
              <button
                onClick={() => (faStage === 'idle' ? requestTwoFA(!twoFA) : setFaStage('idle'))}
                aria-pressed={twoFA}
                disabled={faBusy}
                className={`relative h-6 w-11 rounded-full transition-colors ${twoFA ? 'bg-primary' : 'bg-muted'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${twoFA ? 'left-0.5' : 'left-[22px]'}`}
                />
              </button>
            </div>

            {faStage === 'code' && (
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fa-code">
                    رمز {faTarget ? 'تفعيل' : 'تعطيل'} التحقق بخطوتين
                  </Label>
                  <Input
                    id="fa-code"
                    inputMode="numeric"
                    value={faCode}
                    onChange={(e) => setFaCode(e.target.value)}
                    placeholder="000000"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmTwoFA} disabled={faBusy || !faCode} className="gap-2">
                    {faBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    تأكيد
                  </Button>
                  <Button variant="ghost" onClick={() => setFaStage('idle')}>
                    إلغاء
                  </Button>
                </div>
              </div>
            )}
            {faMsg && <p className={`text-xs ${faMsg.type === 'ok' ? 'text-primary' : 'text-destructive'}`}>{faMsg.text}</p>}
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
            <div className="flex-1 rounded-lg border border-border/60 bg-background px-4 py-2.5 font-mono text-sm tracking-wider">
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
