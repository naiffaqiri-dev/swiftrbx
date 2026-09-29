export const CATALOG_CATEGORIES = ['limited', 'account', 'map_item'] as const

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number]

export type CatalogItem = {
  id: string
  seller_id: string
  category: CatalogCategory
  name: string
  description: string | null
  image_url: string
  links: string[]
  game: string
  active: boolean
  created_at: string
  price_sar: number | null
  map_category: string | null
  game_emoji: string | null
  map_category_emoji: string | null
  map_thumbnail_url: string | null
  map_url: string | null
  seller: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    rating: number
    rating_count: number
  }
}

export const CATALOG_CATEGORY_INFO: Record<CatalogCategory, { label: string; singular: string; description: string }> = {
  limited: {
    label: 'اللميتدز',
    singular: 'قطعة ليمتد',
    description: 'اكتشف القطع النادرة من متاجر البائعين، واختر البائع لعرض كامل مخزونه.',
  },
  account: {
    label: 'حسابات Roblox',
    singular: 'حساب Roblox',
    description: 'تصفّح حسابات Roblox المعروضة، وشاهد تفاصيلها وروابط البائع.',
  },
  map_item: {
    label: 'أغراض المابات',
    singular: 'غرض ماب',
    description: 'أغراض وأدوات المابات من بائعين مختلفين، مرتّبة حسب اللعبة والبائع.',
  },
}

export const CATALOG_PATHS: Record<CatalogCategory, string> = {
  limited: '/market/limiteds',
  account: '/market/accounts',
  map_item: '/market/map-items',
}

export function categoryFromPath(path: string): CatalogCategory | null {
  if (path === 'limiteds') return 'limited'
  if (path === 'accounts') return 'account'
  if (path === 'map-items') return 'map_item'
  return null
}

export function canSellCategory(_role: string | null | undefined, permissions: string[] | null | undefined, category: CatalogCategory) {
  return permissions?.includes(category) === true
}

export function canManageCatalog(role: string | null | undefined, permissions: string[] | null | undefined) {
  return role === 'seller' || CATALOG_CATEGORIES.some((category) => permissions?.includes(category))
}

export function sellerPermissions(value: unknown): CatalogCategory[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is CatalogCategory => CATALOG_CATEGORIES.includes(entry as CatalogCategory))
}

export function isValidCatalogPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1_000_000
    && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
}

export function validHttpsLinks(value: unknown) {
  if (!Array.isArray(value) || value.length > 5) return false
  return value.every((entry) => {
    if (typeof entry !== 'string' || entry.length > 500) return false
    try {
      return new URL(entry).protocol === 'https:'
    } catch {
      return false
    }
  })
}

export function categoryFromPermission(category: string): CatalogCategory | null {
  return CATALOG_CATEGORIES.includes(category as CatalogCategory) ? (category as CatalogCategory) : null
}

export function categorySellerLabel(category: CatalogCategory) {
  return category === 'map_item' ? 'بائع أغراض مابات' : category === 'account' ? 'بائع حسابات' : 'بائع ليمتدز'
}

export function categoryRouteName(category: CatalogCategory) {
  return category === 'limited' ? 'اللميتدز' : category === 'account' ? 'الحسابات' : 'أغراض المابات'
}

export function categorySortLabel(category: CatalogCategory) {
  return category === 'map_item' ? 'اللعبة' : category === 'account' ? 'الحساب' : 'القطعة'
}

export function canAssignCatalogPermissions(values: unknown): values is CatalogCategory[] {
  return Array.isArray(values) && values.every((value) => CATALOG_CATEGORIES.includes(value as CatalogCategory))
} 
