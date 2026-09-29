'use client'

import Image from 'next/image'
import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { Check, ExternalLink, ImagePlus, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { mutate } from 'swr'
import { CATALOG_CATEGORY_INFO, isValidCatalogPrice, type CatalogCategory, type CatalogItem } from '@/lib/catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type MarketplaceGame = { id: string; name: string; emoji: string | null }

const fetcher = async (url: string): Promise<{ items: CatalogItem[] }> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('تعذّر تحميل المنتجات')
  return response.json()
}

const gamesFetcher = async (url: string): Promise<{ maps: MarketplaceGame[] }> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('تعذّر تحميل فئات المابات')
  return response.json()
}

export function SellerCatalogManager({ category }: { category: CatalogCategory }) {
  const key = `/api/catalog?${new URLSearchParams({ category, mine: '1' })}`
  const { data, error, isLoading } = useSWR(key, fetcher)
  const { data: gamesData, isLoading: gamesLoading, error: gamesError } = useSWR(category === 'map_item' ? '/api/marketplace-games' : null, gamesFetcher)
  const games = gamesData?.maps ?? []
  const [open, setOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [name, setName] = useState('')
  const [priceSar, setPriceSar] = useState('')
  const [stockQuantity, setStockQuantity] = useState('1')
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({})
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null)
  const [savingStockId, setSavingStockId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [gameId, setGameId] = useState('')
  const [mapCategory, setMapCategory] = useState('')
  const [mapCategoryEmoji, setMapCategoryEmoji] = useState('')
  const [mapThumbnailUrl, setMapThumbnailUrl] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [links, setLinks] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const items = data?.items ?? []

  function clearForm() {
    setEditingItem(null)
    setName('')
    setPriceSar('')
    setStockQuantity('1')
    setDescription('')
    setGameId('')
    setMapCategory('')
    setMapCategoryEmoji('')
    setMapThumbnailUrl('')
    setMapUrl('')
    setLinks('')
    setImage(null)
  }

  function startCreating() {
    clearForm()
    setFailure('')
    setMessage('')
    setOpen(true)
  }

  function startEditing(item: CatalogItem) {
    setEditingItem(item)
    setName(item.name)
    setPriceSar(String(item.price_sar ?? ''))
    setStockQuantity(String(item.stock_quantity))
    setDescription(item.description ?? '')
    setGameId(item.game_id ?? games.find((game) => game.name === item.game)?.id ?? '')
    setMapCategory(item.map_category ?? '')
    setMapCategoryEmoji(item.map_category_emoji ?? '')
    setMapThumbnailUrl(item.map_thumbnail_url ?? '')
    setMapUrl(item.map_url ?? '')
    setLinks(item.links.join('\n'))
    setImage(null)
    setFailure('')
    setMessage('')
    setOpen(true)
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || (!editingItem && !image)) return
    const formElement = event.currentTarget
    const isEditing = Boolean(editingItem)
    setSaving(true)
    setFailure('')
    setMessage('')
    const cleanLinks = [...new Set(links.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))]
    const body = new FormData()
    body.set('category', category)
    body.set('name', name)
    body.set('priceSar', priceSar)
    body.set('stockQuantity', stockQuantity)
    body.set('description', description)
    body.set('gameId', gameId)
    body.set('mapCategory', mapCategory.trim())
    body.set('mapCategoryEmoji', mapCategoryEmoji.trim())
    body.set('mapThumbnailUrl', mapThumbnailUrl.trim())
    body.set('mapUrl', mapUrl.trim())
    body.set('links', JSON.stringify(cleanLinks))
    if (image) body.set('image', image)
    if (editingItem) body.set('id', editingItem.id)

    const response = await fetch('/api/catalog', { method: editingItem ? 'PUT' : 'POST', body }).catch(() => null)
    const result = response ? await response.json().catch(() => ({})) : {}
    if (!response?.ok) {
      setFailure(result.error ?? 'تعذّر نشر المنتج')
      setSaving(false)
      return
    }
    clearForm()
    formElement.reset()
    setOpen(false)
    setMessage(isEditing ? 'تم حفظ تعديلات المنتج' : 'تم نشر المنتج في متجرك')
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

  async function savePrice(item: CatalogItem) {
    const price = Number(priceDrafts[item.id] ?? item.price_sar ?? 0)
    if (!isValidCatalogPrice(price)) {
      setFailure('أدخل سعراً صحيحاً بالريال السعودي')
      return
    }
    setSavingPriceId(item.id)
    setFailure('')
    const response = await fetch('/api/catalog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, priceSar: price }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setFailure(result.error ?? 'تعذّر تحديث السعر')
    else {
      setMessage('تم تحديث سعر المنتج')
      await mutate(key)
    }
    setSavingPriceId(null)
  }

  async function saveStock(item: CatalogItem) {
    const stockQuantity = Number(stockDrafts[item.id] ?? item.stock_quantity)
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1_000_000) {
      setFailure('أدخل كمية صحيحة بين صفر ومليون')
      return
    }
    setSavingStockId(item.id)
    setFailure('')
    const response = await fetch('/api/catalog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, stockQuantity }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setFailure(result.error ?? 'تعذّر تحديث المخزون')
    else {
      setMessage('تم تحديث الكمية المتاحة')
      await mutate(key)
    }
    setSavingStockId(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border/60 bg-card/40 p-5">
        <div>
          <p className="text-sm text-muted-foreground">متجرك · {CATALOG_CATEGORY_INFO[category].label}</p>
          <h2 className="mt-1 text-xl font-bold">إدارة المنتجات</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">أضف صورة المنتج واسمه وسعره، وأكمل الوصف والروابط. لأكثر من فئة في الماب نفسه، أضف منتجاً لكل فئة.</p>
        </div>
        <Button onClick={startCreating}><Plus data-icon="inline-start" />إضافة {CATALOG_CATEGORY_INFO[category].singular}</Button>
      </div>

      {message && <p role="status" className="inline-flex items-center gap-2 text-sm text-primary"><Check className="size-4" />{message}</p>}
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}

      {open && (
        <form key={editingItem?.id ?? 'new-product'} onSubmit={saveItem} className="grid gap-5 rounded-2xl border border-border/60 bg-card/50 p-5 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2"><h3 className="text-lg font-bold">{editingItem ? `تعديل ${CATALOG_CATEGORY_INFO[category].singular}` : `إضافة ${CATALOG_CATEGORY_INFO[category].singular}`}</h3><p className="text-sm text-muted-foreground">{editingItem ? 'حدّث تفاصيل المنتج في نفس نموذج الإضافة. اترك اختيار الصورة فارغاً للاحتفاظ بالصورة الحالية.' : 'أدخل تفاصيل المنتج ليظهر في متجرك.'}</p></div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`catalog-image-${category}`}>صورة المنتج {!editingItem && <span className="text-destructive">*</span>}</Label>
              {editingItem && <div className="flex items-center gap-3 rounded-lg border border-border/60 p-2"><Image src={editingItem.image_url} alt={`الصورة الحالية لـ ${editingItem.name}`} width={64} height={64} className="size-16 rounded-md object-cover" unoptimized /><span className="text-sm text-muted-foreground">الصورة الحالية</span></div>}
              <Input id={`catalog-image-${category}`} type="file" accept="image/png,image/jpeg,image/webp,image/avif" required={!editingItem} onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">{image ? `الصورة الجديدة: ${image.name}` : 'PNG أو JPEG أو WebP أو AVIF، بحد أقصى 8 ميغابايت.'}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`catalog-name-${category}`}>اسم المنتج <span className="text-destructive">*</span></Label>
              <Input id={`catalog-name-${category}`} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required placeholder={CATALOG_CATEGORY_INFO[category].singular} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`catalog-price-${category}`}>السعر بالريال السعودي <span className="text-destructive">*</span></Label>
              <Input id={`catalog-price-${category}`} type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" value={priceSar} onChange={(event) => setPriceSar(event.target.value)} required placeholder="مثال: 25.00" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`catalog-stock-${category}`}>الكمية المتاحة <span className="text-destructive">*</span></Label>
              <Input id={`catalog-stock-${category}`} type="number" inputMode="numeric" min={editingItem ? '0' : '1'} max="1000000" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} required />
              <p className="text-xs text-muted-foreground">عدد القطع من هذا المنتج نفسه المتوفرة للبيع.</p>
            </div>
            {category === 'map_item' && <>
              <div className="flex flex-col gap-2"><Label htmlFor={`catalog-game-${category}`}>الماب المعتمد <span className="text-destructive">*</span></Label><select id={`catalog-game-${category}`} value={gameId} onChange={(event) => setGameId(event.target.value)} required disabled={gamesLoading || games.length === 0} className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"><option value="">{gamesLoading ? 'جارٍ تحميل المابات…' : 'اختر ماباً أضافته الإدارة'}</option>{games.map((game) => <option key={game.id} value={game.id}>{game.emoji ? `${game.emoji} ` : ''}{game.name}</option>)}</select>{gamesError ? <p role="alert" className="text-xs text-destructive">تعذّر تحميل المابات المعتمدة. حدّث الصفحة وحاول مجدداً.</p> : games.length === 0 && !gamesLoading ? <p className="text-xs text-muted-foreground">لا توجد مابات معتمدة حالياً. تواصل مع الإدارة لإضافة الماب أولاً.</p> : <p className="text-xs text-muted-foreground">يمكنك الاختيار من المابات التي أضافتها الإدارة فقط.</p>}</div>
              <div className="flex flex-col gap-2"><Label htmlFor={`catalog-map-category-${category}`}>اسم الفئة داخل الماب <span className="text-destructive">*</span></Label><div className="flex gap-2"><Input id={`catalog-map-category-${category}`} value={mapCategory} onChange={(event) => setMapCategory(event.target.value)} minLength={2} maxLength={60} required placeholder="مثال: أسلحة نادرة" /><Input aria-label="إيموجي الفئة" value={mapCategoryEmoji} onChange={(event) => setMapCategoryEmoji(event.target.value)} maxLength={16} className="w-20 text-center" placeholder="⚔️" /></div><p className="text-xs leading-relaxed text-muted-foreground">يمكنك إضافة عدة فئات للعبة نفسها؛ أنشئ منتجاً لكل فئة وكرّر اسم الماب.</p></div>
              <div className="flex flex-col gap-2"><Label htmlFor={`catalog-map-thumbnail-${category}`}>رابط صورة مصغرة للماب (اختياري)</Label><Input id={`catalog-map-thumbnail-${category}`} type="url" inputMode="url" dir="ltr" value={mapThumbnailUrl} onChange={(event) => setMapThumbnailUrl(event.target.value)} maxLength={500} placeholder="https://..." /></div>
              <div className="flex flex-col gap-2"><Label htmlFor={`catalog-map-url-${category}`}>رابط الماب أو اللعبة (اختياري)</Label><Input id={`catalog-map-url-${category}`} type="url" inputMode="url" dir="ltr" value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} maxLength={500} placeholder="https://www.roblox.com/games/..." /></div>
            </>}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label htmlFor={`catalog-description-${category}`}>الوصف (اختياري)</Label><Textarea id={`catalog-description-${category}`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} placeholder="أضف تفاصيل تساعد المشتري على معرفة المنتج" /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`catalog-links-${category}`}>روابط المنتج (اختياري)</Label><Textarea id={`catalog-links-${category}`} value={links} onChange={(event) => setLinks(event.target.value)} rows={3} dir="ltr" placeholder={'https://...\nhttps://...'} /><p className="text-xs text-muted-foreground">رابط HTTPS واحد في كل سطر، حتى 5 روابط.</p></div>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={saving || (!editingItem && !image) || (category === 'map_item' && (gamesLoading || games.length === 0 || !gameId))}>{saving ? <Loader2 className="size-4 animate-spin" /> : editingItem ? <Check className="size-4" /> : <ImagePlus className="size-4" />}{saving ? (editingItem ? 'جارٍ حفظ التعديلات…' : 'جارٍ النشر…') : editingItem ? 'حفظ التعديلات' : 'نشر في المتجر'}</Button><Button type="button" variant="outline" onClick={() => { clearForm(); setOpen(false) }} disabled={saving}>إلغاء</Button></div>
        </form>
      )}

      {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل منتجاتك…</p> : error ? <p role="alert" className="text-sm text-destructive">{error.message}</p> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">لم تضف منتجات لهذا القسم بعد.</div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            <div className="relative aspect-[4/3] bg-muted"><Image src={item.image_url} alt={item.name} fill sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized /></div>
            <div className="flex flex-col gap-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.game_emoji && `${item.game_emoji} `}{item.game}</p>{item.map_category && <p className="mt-1 text-xs font-medium">{item.map_category_emoji && `${item.map_category_emoji} `}{item.map_category}</p>}{item.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>}{item.map_url && <a href={item.map_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">رابط الماب<ExternalLink className="size-3" /></a>}</div><span className="rounded-full border border-border/60 px-2.5 py-1 text-xs">{item.active ? 'معروض' : 'مخفي'}</span></div>
              <div className="flex items-end gap-2"><div className="flex min-w-0 flex-1 flex-col gap-1"><Label htmlFor={`catalog-price-edit-${item.id}`} className="text-xs">السعر (ر.س)</Label><Input id={`catalog-price-edit-${item.id}`} type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" value={priceDrafts[item.id] ?? String(item.price_sar ?? '')} onChange={(event) => setPriceDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /></div><Button size="sm" variant="outline" onClick={() => savePrice(item)} disabled={savingPriceId === item.id}>{savingPriceId === item.id ? <Loader2 className="size-4 animate-spin" /> : 'حفظ السعر'}</Button></div>
              <div className="flex items-end gap-2"><div className="flex min-w-0 flex-1 flex-col gap-1"><Label htmlFor={`catalog-stock-edit-${item.id}`} className="text-xs">الكمية المتاحة</Label><Input id={`catalog-stock-edit-${item.id}`} type="number" inputMode="numeric" min="0" max="1000000" step="1" value={stockDrafts[item.id] ?? String(item.stock_quantity)} onChange={(event) => setStockDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /></div><Button size="sm" variant="outline" onClick={() => saveStock(item)} disabled={savingStockId === item.id}>{savingStockId === item.id ? <Loader2 className="size-4 animate-spin" /> : 'حفظ الكمية'}</Button></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => startEditing(item)}><Pencil data-icon="inline-start" />تعديل المنتج</Button><Button size="sm" variant="outline" onClick={() => toggleItem(item)}>{item.active ? 'إخفاء' : 'إظهار'}</Button>{item.links[0] && <a href={item.links[0]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-primary">رابط المنتج<ExternalLink className="size-3" /></a>}<Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeItem(item.id)} aria-label={`حذف ${item.name}`}><Trash2 className="size-4" /></Button></div>
            </div>
          </article>)}
        </div>
      )}
    </div>
  )
}
