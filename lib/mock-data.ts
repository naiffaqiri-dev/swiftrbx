export type DeliveryType = 'group' | 'gamepass' | 'gift' | 'plus'

export const DELIVERY_TYPES: DeliveryType[] = ['group', 'gamepass', 'gift', 'plus']

export const DELIVERY_LABELS: Record<DeliveryType, string> = {
  group: 'تسليم عبر المجموعة (Group Payout)',
  gamepass: 'تسليم عبر Gamepass',
  gift: 'إهداء داخل اللعبة (In-Game Gifting)',
  plus: 'تحويل بلس (Plus Transfer)',
}

export const DELIVERY_NOTES: Record<DeliveryType, string> = {
  group: 'يُستلم خلال 5–7 أيام حسب سياسة روبلوكس، بدون رسوم إضافية.',
  gamepass: 'تسليم أسرع لكن روبلوكس تخصم 30% من الكمية، احتسبناها في السعر.',
  gift: 'إهداء العنصر مباشرة لحسابك داخل اللعبة، يتطلب توفر خاصية الإهداء.',
  plus: 'تحويل عبر خدمة بلس، سريع ويتطلب تأكيد اسم المستخدم.',
}

// عرض بائع حقيقي قادم من دالة active_offers في قاعدة البيانات
export type ActiveOffer = {
  id: string
  seller_id: string
  username: string
  rating: number
  rating_count: number
  available: number
  min_amount: number
  max_amount: number
  rate: number // السعر بالدولار لكل 1000 روبوكس
  delivery: DeliveryType[]
}

export type MatchedOffer = ActiveOffer & { price: number }

export function matchOffers(
  offers: ActiveOffer[],
  amount: number,
  delivery: DeliveryType,
): MatchedOffer[] {
  if (!amount || amount <= 0) return []
  return offers
    .filter(
      (o) =>
        Array.isArray(o.delivery) &&
        o.delivery.includes(delivery) &&
        amount >= Number(o.min_amount) &&
        amount <= Number(o.max_amount) &&
        Number(o.available) >= amount &&
        Number(o.rate) > 0,
    )
    .map((o) => ({ ...o, price: +((amount / 1000) * Number(o.rate)).toFixed(2) }))
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
