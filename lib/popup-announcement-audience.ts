import { createAdminClient } from '@/lib/supabase/admin'

export async function isCompletedPurchaser(profileId: string) {
  const admin = createAdminClient()
  const [orderResult, paymentResult] = await Promise.all([
    admin
      .from('orders')
      .select('id')
      .eq('buyer_id', profileId)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle(),
    admin
      .from('marketplace_payments')
      .select('id')
      .eq('buyer_id', profileId)
      .in('status', ['held', 'released'])
      .limit(1)
      .maybeSingle(),
  ])

  if (orderResult.error || paymentResult.error) return false
  return Boolean(orderResult.data || paymentResult.data)
}
