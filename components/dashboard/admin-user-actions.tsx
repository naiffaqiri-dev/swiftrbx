'use client'

import { useState } from 'react'
import type { ManagedUser } from '@/components/auth/mock-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, Wallet, X } from 'lucide-react'

 type SupportAccount = {
  username: string
  displayName: string | null
  email: string | null
  role: string
  balance: number
  active: boolean
  createdAt: string
}

export function AdminUserActions({
  user,
  onBalanceUpdated,
}: {
  user: ManagedUser
  onBalanceUpdated: () => Promise<void>
}) {
  const [dialog, setDialog] = useState<'balance' | 'support' | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [supportAccount, setSupportAccount] = useState<SupportAccount | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const closeDialog = () => {
    if (pending) return
    setDialog(null)
    setSupportAccount(null)
    setError('')
  }

  const request = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/admin/users/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ...body }),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) throw new Error(result?.error ?? 'تعذّر تنفيذ الطلب')
    return result
  }

  const adjustBalance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const delta = Number(amount)
    if (!Number.isFinite(delta) || delta === 0 || Math.round(delta * 100) !== delta * 100) {
      setError('أدخل مبلغاً صحيحاً لا يساوي صفراً وبحد أقصى منزلتين عشريتين')
      return
    }
    setPending(true)
    setError('')
    try {
      await request({ action: 'balance_adjustment', amount: delta, reason: reason.trim() })
      await onBalanceUpdated()
      setDialog(null)
      setAmount('')
      setReason('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر تعديل الرصيد')
    } finally {
      setPending(false)
    }
  }

  const openSupportView = async () => {
    setPending(true)
    setError('')
    try {
      const result = await request({ action: 'support_view' })
      setSupportAccount(result.account)
      setDialog('support')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر فتح عرض الحساب')
      setDialog('support')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => { setError(''); setDialog('balance') }} disabled={user.role === 'owner'}>
          <Wallet data-icon="inline-start" /> تعديل الرصيد
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={openSupportView} disabled={user.role === 'owner' || pending}>
          <Eye data-icon="inline-start" /> فتح الحساب
        </Button>
      </div>

      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}
          onKeyDown={(event) => { if (event.key === 'Escape') closeDialog() }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="admin-user-dialog-title" className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 id="admin-user-dialog-title" className="font-semibold">
                  {dialog === 'balance' ? 'تعديل رصيد المستخدم' : 'عرض حساب المستخدم'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{user.username}</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={closeDialog} aria-label="إغلاق">
                <X />
              </Button>
            </div>

            {dialog === 'balance' ? (
              <form onSubmit={adjustBalance} className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-muted-foreground">الرصيد الحالي: {user.balance.toFixed(2)} SAR. استخدم مبلغاً موجباً للإضافة أو سالباً للخصم.</p>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`balance-delta-${user.id}`}>المبلغ (SAR)</Label>
                  <Input id={`balance-delta-${user.id}`} type="number" inputMode="decimal" step="0.01" min="-9999999999.99" max="9999999999.99" value={amount} onChange={(event) => setAmount(event.target.value)} required autoFocus />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`balance-reason-${user.id}`}>سبب التعديل</Label>
                  <textarea id={`balance-reason-${user.id}`} value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={300} required rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="اكتب سبباً واضحاً يظهر في سجل التدقيق" />
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={pending}>إلغاء</Button>
                  <Button type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ…' : 'تأكيد التعديل'}</Button>
                </div>
              </form>
            ) : supportAccount ? (
              <div className="flex flex-col gap-4">
                <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed text-muted-foreground">عرض دعم للقراءة فقط. لا يتم الدخول إلى جلسة المستخدم أو تنفيذ أي إجراء باسمه.</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">اسم المستخدم</dt><dd className="break-all font-medium">{supportAccount.username}</dd>
                  <dt className="text-muted-foreground">الاسم الظاهر</dt><dd className="break-all">{supportAccount.displayName || '—'}</dd>
                  <dt className="text-muted-foreground">البريد</dt><dd className="break-all">{supportAccount.email || '—'}</dd>
                  <dt className="text-muted-foreground">نوع الحساب</dt><dd>{supportAccount.role}</dd>
                  <dt className="text-muted-foreground">الرصيد</dt><dd>{supportAccount.balance.toFixed(2)} SAR</dd>
                  <dt className="text-muted-foreground">الحالة</dt><dd>{supportAccount.active ? 'نشط' : 'غير نشط'}</dd>
                  <dt className="text-muted-foreground">تاريخ التسجيل</dt><dd>{new Date(supportAccount.createdAt).toLocaleDateString('ar-SA')}</dd>
                </dl>
                <div className="flex justify-end"><Button type="button" onClick={closeDialog}>إغلاق العرض</Button></div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p role={error ? 'alert' : 'status'} className={error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{error || 'جارٍ فتح عرض الحساب الآمن…'}</p>
                <div className="flex justify-end"><Button type="button" variant="outline" onClick={closeDialog} disabled={pending}>إغلاق</Button></div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}

