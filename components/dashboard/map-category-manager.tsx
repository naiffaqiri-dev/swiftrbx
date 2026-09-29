'use client'

import Image from 'next/image'
import { useState, type FormEvent } from 'react'
import useSWR, { mutate } from 'swr'
import { Gamepad2, ImagePlus, Loader2, Plus, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type MapCategory = { id: string; name: string; emoji: string | null; thumbnail_url: string | null; active: boolean }

const fetcher = async (url: string): Promise<{ maps: MapCategory[] }> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('تعذّر تحميل فئات المابات')
  return response.json()
}

const KEY = '/api/admin/marketplace-games'

export function MapCategoryManager() {
  const { data, error, isLoading } = useSWR(KEY, fetcher)
  const [name, setName] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const maps = data?.maps ?? []

  async function addMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const formElement = event.currentTarget
    setSaving(true)
    setFailure('')
    setMessage('')
    const form = new FormData()
    form.set('name', name)
    if (image) form.set('image', image)
    const response = await fetch(KEY, {
      method: 'POST',
      body: form,
    }).catch(() => null)
    const result = response ? await response.json().catch(() => ({})) : {}
    if (!response?.ok) {
      setFailure(result.error ?? 'تعذّرت إضافة الماب')
      setSaving(false)
      return
    }
    setName('')
    setImage(null)
    formElement.reset()
    setMessage('تمت إضافة الماب وأصبح متاحاً للبائعين')
    setSaving(false)
    await mutate(KEY)
    await mutate('/api/marketplace-games')
  }

  async function uploadMapThumbnail(map: MapCategory, file: File) {
    setBusyId(map.id)
    setFailure('')
    setMessage('')
    const form = new FormData()
    form.set('id', map.id)
    form.set('image', file)
    const response = await fetch(KEY, { method: 'PATCH', body: form }).catch(() => null)
    const result = response ? await response.json().catch(() => ({})) : {}
    if (!response?.ok) setFailure(result.error ?? 'تعذّر تحديث صورة الماب')
    else {
      setMessage(`تم تحديث صورة ${map.name}`)
      await mutate(KEY)
      await mutate('/api/marketplace-games')
    }
    setBusyId(null)
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
          <Input id="new-map-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required placeholder="مثال: Garden Tower Defense" />
        </div>
        <div className="flex flex-col gap-2 sm:w-64">
          <Label htmlFor="new-map-image">الصورة المصغّرة (اختياري)</Label>
          <Input id="new-map-image" type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">PNG أو JPEG أو WebP أو AVIF، حتى 8 ميغابايت.</p>
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
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-lg" aria-hidden="true">{map.thumbnail_url ? <Image src={map.thumbnail_url} alt="" width={40} height={40} className="size-10 object-cover" unoptimized /> : map.emoji || <Gamepad2 className="size-5" />}</span>
                <div>
                  <p className="font-semibold">{map.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{map.active ? 'متاح للبائعين' : 'موقوف عن الإضافة الجديدة'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`map-thumbnail-${map.id}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  disabled={busyId === map.id}
                  className="sr-only"
                  aria-label={`تحديث صورة ${map.name}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void uploadMapThumbnail(map, file)
                    event.target.value = ''
                  }}
                />
                <Label htmlFor={`map-thumbnail-${map.id}`} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 text-sm font-medium hover:bg-muted">
                  {busyId === map.id ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                  تحديث الصورة
                </Label>
                <Button type="button" size="sm" variant="outline" onClick={() => toggleMap(map)} disabled={busyId === map.id}>
                  {busyId === map.id ? <Loader2 className="size-4 animate-spin" /> : <Power data-icon="inline-start" />}
                  {map.active ? 'إيقاف' : 'تفعيل'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
