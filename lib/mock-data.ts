export type DeliveryType = 'group' | 'gamepass'

export type Supplier = {
  id: string
  name: string
  rating: number
  reviews: number
  stock: number
  min: number
  max: number
  rate: number // السعر بالدولار لكل 1000 روبوكس
  delivery: DeliveryType[]
}

export const DELIVERY_LABELS: Record<DeliveryType, string> = {
  group: 'تسليم عبر المجموعة (Group Payout)',
  gamepass: 'تسليم عبر Gamepass',
}

export const DELIVERY_NOTES: Record<DeliveryType, string> = {
  group: 'يُستلم خلال 5–7 أيام حسب سياسة روبلوكس، بدون رسوم إضافية.',
  gamepass: 'تسليم أسرع لكن روبلوكس تخصم 30% من الكمية، احتسبناها في السعر.',
}

export const SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'ahmad_store', rating: 4.9, reviews: 312, stock: 120000, min: 1000, max: 50000, rate: 4.2, delivery: ['group', 'gamepass'] },
  { id: 's2', name: 'layla_robux', rating: 4.7, reviews: 189, stock: 60000, min: 500, max: 20000, rate: 4.5, delivery: ['group'] },
  { id: 's3', name: 'gcc_gaming', rating: 4.8, reviews: 421, stock: 250000, min: 5000, max: 100000, rate: 4.0, delivery: ['group', 'gamepass'] },
  { id: 's4', name: 'fast_rbx', rating: 4.5, reviews: 96, stock: 15000, min: 300, max: 8000, rate: 4.8, delivery: ['gamepass'] },
  { id: 's5', name: 'trusted_bloxx', rating: 5.0, reviews: 540, stock: 500000, min: 10000, max: 200000, rate: 3.9, delivery: ['group', 'gamepass'] },
]

export type MatchedSupplier = Supplier & { price: number }

export function matchSuppliers(amount: number, delivery: DeliveryType): MatchedSupplier[] {
  if (!amount || amount <= 0) return []
  return SUPPLIERS.filter(
    (s) => s.delivery.includes(delivery) && amount >= s.min && amount <= s.max && s.stock >= amount,
  )
    .map((s) => ({ ...s, price: +((amount / 1000) * s.rate).toFixed(2) }))
    .sort((a, b) => a.price - b.price || b.rating - a.rating)
}

export type Coupon = { code: string; type: 'percent' | 'flat'; value: number }

const COUPONS: Coupon[] = [
  { code: 'SWIFT10', type: 'percent', value: 10 },
  { code: 'WELCOME5', type: 'flat', value: 5 },
]

export function applyCoupon(code: string, subtotal: number): { coupon: Coupon; discount: number } | null {
  const c = COUPONS.find((x) => x.code.toLowerCase() === code.trim().toLowerCase())
  if (!c) return null
  const discount = c.type === 'percent' ? +(subtotal * (c.value / 100)).toFixed(2) : Math.min(c.value, subtotal)
  return { coupon: c, discount }
}
