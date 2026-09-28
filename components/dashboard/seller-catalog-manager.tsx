'use client'

import Image from 'next/image'
import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { Check, ExternalLink, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react'
import { mutate } from 'swr'
import { CATALOG_CATEGORY_INFO, type CatalogCategory, type CatalogItem } from '@/lib/catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const fetcher = async (url: string): Promise<{ items: CatalogItem[] }> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('تعذّر تحميل المنتجات')
  return response.json()
}

export function SellerCatalogManager({ category }: { category: CatalogCategory }) {
  const key = `/api/catalog?${new URLSearchParams({ category, mine: '1' })}`
  const { data, error, isLoading } = useSWR(key, fetcher)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [game, setGame] = useState('')
  const [links, setLinks] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const items = data?.items ?? []

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!image || saving) return
    const formElement = event.currentTarget
    setSaving(true)
    setFailure('')
    setMessage('')
    const cleanLinks = [...new Set(links.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))]
    const body = new FormData()
    body.set('category', category)
    body.set('name', name)
    body.set('description', description)
    body.set('game', game.trim() || 'أغراض عامة')
    body.set('links', JSON.stringify(cleanLinks))
    body.set('image', image)

    const response = await fetch('/api/catalog', { method: 'POST', body }).catch(() => null)
    const result = response ? await response.json().catch(() => ({})) : {}
    if (!response?.ok) {
      setFailure(result.error ?? 'تعذّر نشر المنتج')
      setSaving(false)
      return
    }
    setName('')
    setDescription('')
    setGame('')
    setLinks('')
    setImage(null)
    formElement.reset()
    setOpen(false)
    setMessage('تم نشر المنتج في متجرك')
    setSaving(false)
    await mutate(key)
  }

  async function removeItem(id: string) {
    const response = await fetch('/api/catalog', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!response.ok) {
      setFailure('تعذّر حذف المنتج')
      return
    }
    await mutate(key)
  }

  async function toggleItem(item: CatalogItem) {
    const response = await fetch('/api/catalog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, active: !item.active }) })
    if (!response.ok) {
      setFailure('تعذّر تحديث حالة المنتج')
      return
    }
    await mutate(key)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border/60 bg-card/40 p-5">
        <div>
          <p className="text-sm text-muted-foreground">متجرك · {CATALOG_CATEGORY_INFO[category].label}</p>
          <h2 className="mt-1 text-xl font-bold">إدارة المنتجات</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">أضف صورة المنتج واسمه، ثم أكمل الوصف والروابط إذا رغبت.</p>
        </div>
        <Button onClick={() => { setOpen((value) => !value); setFailure('') }}><Plus data-icon="inline-start" />إضافة {CATALOG_CATEGORY_INFO[category].singular}</Button>
      </div>

      {message && <p role="status" className="inline-flex items-center gap-2 text-sm text-primary"><Check className="size-4" />{message}</p>}
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}

      {open && (
        <form onSubmit={createItem} className="grid gap-5 rounded-2xl border border-border/60 bg-card/50 p-5 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`catalog-image-${category}`}>صورة المنتج <span className="text-destructive">*</span></Label>
              <Input id={`catalog-image-${category}`} type="file" accept="image/png,image/jpeg,image/webp,image/avif" required onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">PNG أو JPEG أو WebP أو AVIF، بحد أقصى 8 ميغابايت.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`catalog-name-${category}`}>اسم المنتج <span className="text-destructive">*</span></Label>
              <Input id={`catalog-name-${category}`} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required placeholder={CATALOG_CATEGORY_INFO[category].singular} />
            </div>
            {category === 'map_item' && <div className="flex flex-col gap-2"><Label htmlFor={`catalog-game-${category}`}>اسم اللعبة أو الماب</Label><Input id={`catalog-game-${category}`} list="roblox-map-games" value={game} onChange={(event) => setGame(event.target.value)} maxLength={40} placeholder="مثال: Blade Ball" /><datalist id="roblox-map-games"><option value="Adopt Me!" /><option value="Blade Ball" /><option value="Murder Mystery 2" /><option value="Blox Fruits" /><option value="أخرى" /></datalist></div>}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label htmlFor={`catalog-description-${category}`}>الوصف (اختياري)</Label><Textarea id={`catalog-description-${category}`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} placeholder="أضف تفاصيل تساعد المشتري على معرفة المنتج" /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`catalog-links-${category}`}>روابط المنتج (اختياري)</Label><Textarea id={`catalog-links-${category}`} value={links} onChange={(event) => setLinks(event.target.value)} rows={3} dir="ltr" placeholder={'https://...\nhttps://...'} /><p className="text-xs text-muted-foreground">رابط HTTPS واحد في كل سطر، حتى 5 روابط.</p></div>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={saving || !image}>{saving ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}{saving ? 'جارٍ النشر…' : 'نشر في المتجر'}</Button><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>إلغاء</Button></div>
        </form>
      )}

      {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل منتجاتك…</p> : error ? <p role="alert" className="text-sm text-destructive">{error.message}</p> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">لم تضف منتجات لهذا القسم بعد.</div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            <div className="relative aspect-[4/3] bg-muted"><Image src={item.image_url} alt={item.name} fill sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized /></div>
            <div className="flex flex-col gap-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.game}</p></div><span className="rounded-full border border-border/60 px-2.5 py-1 text-xs">{item.active ? 'معروض' : 'مخفي'}</span></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => toggleItem(item)}>{item.active ? 'إخفاء' : 'إظهار'}</Button>{item.links[0] && <a href={item.links[0]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-primary">رابط المنتج<ExternalLink className="size-3" /></a>}<Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeItem(item.id)} aria-label={`حذف ${item.name}`}><Trash2 className="size-4" /></Button></div>
            </div>
          </article>)}
        </div>
      )}
    </div>
  )
}
