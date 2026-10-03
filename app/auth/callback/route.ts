import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { safeInternalPath } from '@/lib/auth-redirect'
import { discordProfileFromUser, discordTokenRecord, getDiscordUser, normalizeDiscordName } from '@/lib/discord-profile-sync'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeInternalPath(searchParams.get('next'), '/')

  if (code) {
    const supabase = await createClient()
    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const linkProvider = searchParams.get('link_provider')

      if (user && searchParams.get('enable_discord_sync') === '1') {
        const identity = user.identities?.find((item) => item.provider === 'discord')
        const accessToken = exchangeData.session?.provider_token
        const refreshToken = exchangeData.session?.provider_refresh_token

        if (!identity || !accessToken || !refreshToken) {
          return NextResponse.redirect(`${origin}/account?discord_sync=error`)
        }

        try {
          const discordUser = await getDiscordUser(accessToken)
          const linkedDiscordId = identity.identity_data?.id
          if (typeof linkedDiscordId !== 'string' || linkedDiscordId !== discordUser.id) {
            return NextResponse.redirect(`${origin}/account?discord_sync=error`)
          }

          const admin = createAdminClient()
          const discordProfile = discordProfileFromUser(discordUser)
          const displayName = normalizeDiscordName(discordProfile.displayName)
          const { error: profileError } = await admin
            .from('profiles')
            .update({
              ...(displayName.length >= 2 ? { display_name: displayName } : {}),
              avatar_url: discordProfile.avatarUrl,
            })
            .eq('id', user.id)
          if (profileError) return NextResponse.redirect(`${origin}/account?discord_sync=error`)

          const { error: tokenUpsertError } = await admin
            .from('discord_profile_sync_tokens')
            .upsert(discordTokenRecord(user.id, refreshToken), { onConflict: 'user_id' })
          if (tokenUpsertError) return NextResponse.redirect(`${origin}/account?discord_sync=error`)

          return NextResponse.redirect(`${origin}/account?discord_sync=enabled`)
        } catch {
          return NextResponse.redirect(`${origin}/account?discord_sync=error`)
        }
      }

      if (user && (linkProvider === 'discord' || linkProvider === 'google')) {
        const identity = user.identities?.find((item) => item.provider === linkProvider)
        if (!identity) return NextResponse.redirect(`${origin}/account`)

        if (linkProvider === 'discord' && !user.user_metadata?.discord_profile_imported_at) {
          const identityData = identity.identity_data ?? {}
          const displayName = String(
            identityData.global_name ?? identityData.full_name ?? identityData.name ?? identityData.username ?? '',
          ).trim().slice(0, 24)
          const candidateAvatar = String(identityData.avatar_url ?? identityData.picture ?? '')
          const avatarUrl = candidateAvatar.startsWith('https://') ? candidateAvatar : ''
          const profileUpdate: { display_name?: string; avatar_url?: string } = {}
          if (displayName.length >= 2) profileUpdate.display_name = displayName
          if (avatarUrl) profileUpdate.avatar_url = avatarUrl

          const admin = createAdminClient()
          const { error: profileError } = Object.keys(profileUpdate).length
            ? await admin.from('profiles').update(profileUpdate).eq('id', user.id)
            : { error: null }

          if (!profileError) {
            await admin.auth.admin.updateUserById(user.id, {
              user_metadata: {
                ...user.user_metadata,
                discord_profile_imported_at: new Date().toISOString(),
              },
            })
          }
        }

        return NextResponse.redirect(`${origin}${next}`)
      }

      // مستخدمو Google/Discord الجدد يكملون نموذج إنشاء الحساب لمرة واحدة فقط
      if (user) {
        const admin = createAdminClient()
        const { data: profile } = await admin
          .from('profiles')
          .select('onboarded')
          .eq('id', user.id)
          .maybeSingle()
        if (!profile?.onboarded) {
          return NextResponse.redirect(`${origin}/onboarding?${new URLSearchParams({ next }).toString()}`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
