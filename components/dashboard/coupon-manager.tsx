'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Ticket, Power } from 'lucide-react'

type Coupon = {
  id: string
  code: string
  kind: string
  percent: number
  active: boolean
}

export function CouponManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<'discount' | 'referral'>('discount')
  const [percent, setPercent] = useState(5)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('coupons')
      .select('id, code, kind, percent, active')
      .order('created_at', { ascending: false })
    setCoupons((data ?? []) as Coupon[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create() {
    setError('')
    const clean = code.trim().toUpperCase()
    if (!clean) {
      setError('أدخل رمز الكوبون')
      return
    }
    if (percent <= 0 || percent > 100) {
      setError('النسبة يجب أن تكون بين 1 و 100')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('coupons').insert({ code: clean, kind, percent, active: true })
    setSaving(false)
    if (err) {
      setError(err.message.includes('duplicate') ? 'هذا الرمز موجود مسبقاً' : 'تعذّر إنشاء الكوبون')
      return
    }
    setCode('')
    setPercent(5)
    load()
  }

  async function toggle(c: Coupon) {
    const supabase = createClient()
    await supabase.from('coupons').update({ active: !c.active }).eq('id', c.id)
    load()
  }

  async function remove(id: string) {
    const supabase = createClient()
    await supabase.from('coupons').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="max-w-md space-y-3 rounded-xl border border-border/60 bg-card/40 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Plus className="h-4 w-4 text-primary" /> إنشاء كوبون / رمز إحالة
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="code">الرمز</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثال: SWIFT10" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="kind">النوع</Label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'discount' | 'referral')}
              className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
            >
              <option value="discount">خصم</option>
              <option value="referral">إحالة</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="percent">النسبة (%)</Label>
            <Input id="percent" type="number" value={percent} onChange={(e) => setPercent(+e.target.value)} />
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={create} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} إنشاء
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Ticket className="h-4 w-4 text-primary" /> الكوبونات الحالية ({coupons.length})
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
          </div>
        ) : coupons.length === 0 ? (
          <p className="rounded-xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            لا توجد كوبونات بعد.
          </p>
        ) : (
          coupons.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <div className="space-y-0.5">
                <div className="font-bold">{c.code}</div>
                <div className="text-xs text-muted-foreground">
                  {c.kind === 'referral' ? 'إحالة' : 'خصم'} · {c.percent}%
                  {' · '}
                  <span className={c.active ? 'text-primary' : 'text-destructive'}>
                    {c.active ? 'مفعّل' : 'معطّل'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => toggle(c)} className="gap-1">
                  <Power className="h-3.5 w-3.5" /> {c.active ? 'تعطيل' : 'تفعيل'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
