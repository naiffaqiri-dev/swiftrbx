import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const PAYMENT_COLUMNS =
  'id, status, expires_at, buyer_id, seller_id, offer_id, robux_amount, roblox_username, delivery_method, seller_name, total_sar, bank_key, bank_name, bank_account, bank_iban, bank_holder'

export type DiscordTicketPayment = {
  id: string
  status: string
  expires_at: string
  buyer_id: string
  seller_id: string
  offer_id: string
  robux_amount: number
  roblox_username: string
  delivery_method: string
  seller_name: string
  total_sar: number
  bank_key: string | null
  bank_name: string | null
  bank_account: string | null
  bank_iban: string | null
  bank_holder: string | null
}

export type PaymentLookupOutcome =
  | { kind: 'ok'; payment: DiscordTicketPayment }
  | { kind: 'not_found' }
  | { kind: 'already_submitted' }
  | { kind: 'expired' }

export function hashDiscordTicketToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export async function lookupDiscordTicketPayment(token: string, buyerId: string): Promise<PaymentLookupOutcome> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('discord_ticket_payments')
    .select(PAYMENT_COLUMNS)
    .eq('token_hash', hashDiscordTicketToken(token))
    .eq('buyer_id', buyerId)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    console.warn('[discord-ticket-payment] lookup outcome: not_found')
    return { kind: 'not_found' }
  }

  const payment = data as unknown as DiscordTicketPayment
  if (payment.status === 'submitted' || payment.status === 'submitting') {
    console.warn('[discord-ticket-payment] lookup outcome: already_submitted', payment.status)
    return { kind: 'already_submitted' }
  }
  if (payment.status !== 'issued' || new Date(payment.expires_at).getTime() <= Date.now()) {
    console.warn('[discord-ticket-payment] lookup outcome: expired', payment.status)
    return { kind: 'expired' }
  }

  return { kind: 'ok', payment }
}
