'use client'

import { useState, type FormEvent } from 'react'
import useSWR, { mutate } from 'swr'
import { Gamepad2, Loader2, Plus, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type MapCategory = { id: string; name: string; emoji: string | null; active: boolean }

const fetcher = async (url: string): Promise<{ maps: MapCategory[] }> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('تعذّر تحميل فئات المابات')
  return response.json()
}

const KEY = '/api/admin/marketplace-games'

export function MapCategoryManager() {
  const { data, error, isLoading } = useSWR(KEY, fetcher)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const maps = data?.maps ?? []

  async function addMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFailure('')
    setMessage('')
    const response = await fetch(KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => null)
    const result = response ? await response.json().catch(() => ({})) : {}
    if (!response?.ok) {
      setFailure(result.error ?? 'تعذّرت إضافة الماب')
      setSaving(false)
      return
    }
    setName('')
    setMessage('تمت إضافة الماب وأصبح متاحاً للبائعين')
    setSaving(false)
    await mutate(KEY)
    await mutate('/api/marketplace-games')
  }

  async function toggleMap(map: MapCategory) {
    setBusyId(map.id)
    setFailure('')
    setMessage('')
    const response = await fetch(KEY, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: map.id, active: !map.active }),
    }).catch(() => null)
    const result = response ? await response.json().catch(() => ({})) : {}
    if (!response?.ok) setFailure(result.error ?? 'تعذّر تحديث حالة الماب')
    else {
      setMessage(map.active ? 'تم إيقاف الماب عن البائعين الجدد' : 'تم تفعيل الماب للبائعين')
      await mutate(KEY)
      await mutate('/api/marketplace-games')
    }
    setBusyId(null)
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="rounded-2xl border border-border/60 bg-card/40 p-5">
        <p className="text-sm text-muted-foreground">إدارة المتجر · أغراض المابات</p>
        <h2 className="mt-1 text-xl font-bold">فئات المابات المعتمدة</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">أضف أسماء المابات هنا. لن يتمكن البائع من نشر غرض ماب إلا بعد اختياره ماباً مضافاً ومعتمداً من هذه القائمة.</p>
      </header>

      <form onSubmit={addMap} className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/40 p-5 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="new-map-name">اسم الماب</Label>
          <Input id="new-map-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required placeholder="مثال: Blade Ball" />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus data-icon="inline-start" />}
          إضافة الماب
        </Button>
      </form>

      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
      {isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">جارٍ تحميل المابات…</p> : maps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 p-10 text-center">
          <Gamepad2 className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">لم تتم إضافة أي ماب بعد. أضف أول ماب ليظهر للبائعين.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border/50 rounded-2xl border border-border/60 bg-card/40">
          {maps.map((map) => (
            <li key={map.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-lg" aria-hidden="true">{map.emoji || <Gamepad2 className="size-5" />}</span>
                <div>
                  <p className="font-semibold">{map.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{map.active ? 'متاح للبائعين' : 'موقوف عن الإضافة الجديدة'}</p>
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => toggleMap(map)} disabled={busyId === map.id}>
                {busyId === map.id ? <Loader2 className="size-4 animate-spin" /> : <Power data-icon="inline-start" />}
                {map.active ? 'إيقاف' : 'تفعيل'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
