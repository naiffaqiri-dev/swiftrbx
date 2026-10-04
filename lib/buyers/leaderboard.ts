import { createAdminClient } from '@/lib/supabase/admin'

export type BuyerEntry = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  totalRobux: number
}

const PAGE_SIZE = 1000
const LEADERBOARD_SIZE = 50
const RIYADH_TIME_ZONE = 'Asia/Riyadh'

function getCurrentMonthStart() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RIYADH_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)

  return new Date(Date.UTC(year, month - 1, 1) - 3 * 60 * 60 * 1000).toISOString()
}

async function getCompletedOrders() {
  const admin = createAdminClient()
  const orders: { buyer_id: string; robux_amount: number; completed_at: string | null }[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from('orders')
      .select('buyer_id, robux_amount, completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw new Error('تعذّر تحميل ترتيب المشترين')
    orders.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  return orders
}

export async function getBuyerLeaderboard(): Promise<{
  allTime: BuyerEntry[]
  monthly: BuyerEntry[]
  monthLabel: string
}> {
  const monthStart = getCurrentMonthStart()
  const orders = await getCompletedOrders()
  const allTimeTotals = new Map<string, number>()
  const monthlyTotals = new Map<string, number>()

  for (const order of orders) {
    const amount = Number(order.robux_amount)
    if (!order.buyer_id || !Number.isFinite(amount) || amount <= 0) continue

    allTimeTotals.set(order.buyer_id, (allTimeTotals.get(order.buyer_id) ?? 0) + amount)
    if (order.completed_at && order.completed_at >= monthStart) {
      monthlyTotals.set(order.buyer_id, (monthlyTotals.get(order.buyer_id) ?? 0) + amount)
    }
  }

  const rankedIds = (totals: Map<string, number>) =>
    [...totals.entries()]
      .sort(([idA, totalA], [idB, totalB]) => totalB - totalA || idA.localeCompare(idB))
      .slice(0, LEADERBOARD_SIZE)
      .map(([id]) => id)
  const profileIds = [...new Set([...rankedIds(allTimeTotals), ...rankedIds(monthlyTotals)])]
  const admin = createAdminClient()
  const profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null }[] = []

  for (let index = 0; index < profileIds.length; index += 100) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', profileIds.slice(index, index + 100))
      .eq('active', true)
    if (error) throw new Error('تعذّر تحميل ملفات المشترين')
    profiles.push(...(data ?? []))
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const buildEntries = (totals: Map<string, number>): BuyerEntry[] =>
    [...totals.entries()]
      .sort(([idA, totalA], [idB, totalB]) => totalB - totalA || idA.localeCompare(idB))
      .flatMap(([id, total]) => {
        const profile = profileById.get(id)
        if (!profile) return []
        return [{
          id,
          username: profile.username,
          displayName: profile.display_name || profile.username,
          avatarUrl: profile.avatar_url,
          totalRobux: total,
        }]
      })
      .slice(0, LEADERBOARD_SIZE)

  return {
    allTime: buildEntries(allTimeTotals),
    monthly: buildEntries(monthlyTotals),
    monthLabel: new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      month: 'long',
      year: 'numeric',
      timeZone: RIYADH_TIME_ZONE,
    }).format(new Date()),
  }
}
