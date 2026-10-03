import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  decryptDiscordRefreshToken,
  discordProfileFromUser,
  encryptDiscordRefreshToken,
  getDiscordUser,
  normalizeDiscordName,
  refreshDiscordAccessToken,
  tokenWasRevoked,
} from '@/lib/discord-profile-sync'

export const runtime = 'nodejs'
export const maxDuration = 60

const BATCH_SIZE = 5
const MAX_RECORDS = 100

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: records, error: queryError } = await admin
    .from('discord_profile_sync_tokens')
    .select('user_id, encrypted_refresh_token')
    .order('updated_at', { ascending: true })
    .limit(MAX_RECORDS)

  if (queryError) return NextResponse.json({ error: 'Could not load sync records' }, { status: 500 })

  let synced = 0
  let removed = 0
  let failed = 0

  for (let index = 0; index < (records ?? []).length; index += BATCH_SIZE) {
    const batch = (records ?? []).slice(index, index + BATCH_SIZE)
    const results = await Promise.allSettled(batch.map(async (record) => {
      let refreshToken = ''
      try {
        refreshToken = decryptDiscordRefreshToken(record.encrypted_refresh_token)
        const tokens = await refreshDiscordAccessToken(refreshToken)
        const discordUser = await getDiscordUser(tokens.access_token)
        const { data: authResult, error: authError } = await admin.auth.admin.getUserById(record.user_id)
        if (authError) throw authError

        const identity = authResult.user?.identities?.find((item) => item.provider === 'discord')
        const linkedDiscordId = identity?.identity_data?.id

        if (typeof linkedDiscordId !== 'string' || linkedDiscordId !== discordUser.id) {
          const { error } = await admin
            .from('discord_profile_sync_tokens')
            .delete()
            .eq('user_id', record.user_id)
          if (error) throw error
          return 'removed' as const
        }

        const profile = discordProfileFromUser(discordUser)
        const displayName = normalizeDiscordName(profile.displayName)
        const { error: profileError } = await admin
          .from('profiles')
          .update({
            ...(displayName.length >= 2 ? { display_name: displayName } : {}),
            avatar_url: profile.avatarUrl,
          })
          .eq('id', record.user_id)
        if (profileError) throw profileError

        const nextRefreshToken = tokens.refresh_token || refreshToken
        const { error: tokenError } = await admin
          .from('discord_profile_sync_tokens')
          .update({
            encrypted_refresh_token: encryptDiscordRefreshToken(nextRefreshToken),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', record.user_id)
        if (tokenError) throw tokenError
        return 'synced' as const
      } catch (error) {
        if (tokenWasRevoked(error)) {
          const { error: deleteError } = await admin
            .from('discord_profile_sync_tokens')
            .delete()
            .eq('user_id', record.user_id)
          if (deleteError) throw deleteError
          return 'removed' as const
        }
        throw error
      }
    }))

    for (const result of results) {
      if (result.status === 'rejected') failed += 1
      else if (result.value === 'removed') removed += 1
      else synced += 1
    }
  }

  return NextResponse.json(
    { checked: (records ?? []).length, synced, removed, failed },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
