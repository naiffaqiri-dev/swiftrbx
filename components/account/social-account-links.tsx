'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Check, Loader2, Link2, RefreshCw, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/components/i18n/locale-provider'
import { createClient } from '@/lib/supabase/client'

type Provider = 'discord' | 'google'
type LinkedIdentities = { providers: string[] }
type DiscordSyncStatus = { enabled: boolean }

const fetcher = async (url: string): Promise<LinkedIdentities> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load linked accounts')
  return response.json()
}

const syncStatusFetcher = async (url: string): Promise<DiscordSyncStatus> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load Discord sync status')
  return response.json()
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.43-1.67 4.2-5.5 4.2-3.31 0-6-2.74-6-6.12s2.69-6.12 6-6.12c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.99 3.36 14.74 2.4 12 2.4 6.85 2.4 2.66 6.58 2.66 11.7S6.85 21 12 21c5.5 0 9.14-3.86 9.14-9.3 0-.62-.07-1.1-.16-1.5H12z"
      />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 27 24" className="size-4 fill-current" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5a13.7 13.7 0 0 1 4.34 2.2 13.5 13.5 0 0 0-11.02 0A13.7 13.7 0 0 1 12.82 3.5L12.58 3A19.8 19.8 0 0 0 7.7 4.4C4.6 9 3.77 13.5 4.18 17.9a19.9 19.9 0 0 0 6.04 3.05l.48-.66a13 13 0 0 1-2.06-.98l.5-.38a14.2 14.2 0 0 0 11.72 0l.5.38c-.65.38-1.34.71-2.06.98l.48.66a19.9 19.9 0 0 0 6.05-3.05c.48-5.11-.82-9.57-3.53-13.5ZM9.68 15.2c-1.18 0-2.15-1.08-2.15-2.4s.95-2.41 2.15-2.41 2.17 1.09 2.15 2.41c0 1.32-.96 2.4-2.15 2.4Zm5.28 0c-1.18 0-2.15-1.08-2.15-2.4s.95-2.41 2.15-2.41 2.17 1.09 2.15 2.41c0 1.32-.95 2.4-2.15 2.4Z" />
    </svg>
  )
}

export function SocialAccountLinks() {
  const { t } = useLocale()
  const { data, error, isLoading } = useSWR<LinkedIdentities>('/api/account/identities', fetcher)
  const providers = data?.providers ?? []
  const {
    data: syncStatus,
    error: syncStatusError,
    isLoading: isSyncStatusLoading,
    mutate: refreshSyncStatus,
  } = useSWR<DiscordSyncStatus>(providers.includes('discord') ? '/api/account/discord-sync' : null, syncStatusFetcher)
  const [pending, setPending] = useState<Provider | null>(null)
  const [linkError, setLinkError] = useState(false)
  const [syncPending, setSyncPending] = useState(false)
  const [syncError, setSyncError] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('discord_sync') === 'error') {
      setSyncError(true)
    }
  }, [])

  async function linkAccount(provider: Provider) {
    setLinkError(false)
    setPending(provider)

    try {
      const redirectTo = new URL(
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
      )
      redirectTo.searchParams.set('next', '/account')
      redirectTo.searchParams.set('link_provider', provider)

      const supabase = createClient()
      const { error: authError } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: redirectTo.toString() },
      })

      if (authError) {
        setLinkError(true)
        setPending(null)
      }
    } catch {
      setLinkError(true)
      setPending(null)
    }
  }

  async function enableDiscordSync() {
    setSyncError(false)
    setSyncPending(true)

    try {
      const redirectTo = new URL(
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
      )
      redirectTo.searchParams.set('next', '/account')
      redirectTo.searchParams.set('enable_discord_sync', '1')

      const { error: authError } = await createClient().auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: redirectTo.toString(), queryParams: { prompt: 'consent' } },
      })

      if (authError) {
        setSyncError(true)
        setSyncPending(false)
      }
    } catch {
      setSyncError(true)
      setSyncPending(false)
    }
  }

  async function disableDiscordSync() {
    setSyncError(false)
    setSyncPending(true)

    try {
      const response = await fetch('/api/account/discord-sync', { method: 'DELETE' })
      if (!response.ok) {
        setSyncError(true)
        return
      }
      await refreshSyncStatus()
    } catch {
      setSyncError(true)
    } finally {
      setSyncPending(false)
    }
  }

  const providerRows: { id: Provider; label: string }[] = [
    { id: 'discord', label: 'Discord' },
    { id: 'google', label: 'Google' },
  ]

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/40 p-4" aria-labelledby="social-accounts-title">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-primary" aria-hidden="true" />
        <h3 id="social-accounts-title" className="text-sm font-bold">{t('ربط الحسابات')}</h3>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t('اربط Discord أو Google بحسابك، ثم فعّل المزامنة لتحديث الاسم والصورة عند التفعيل ومرة يومياً.')}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        {providerRows.map(({ id, label }) => {
          const linked = providers.includes(id)
          const busy = pending === id
          const Icon = id === 'discord' ? DiscordIcon : GoogleIcon

          return linked ? (
            <div
              key={id}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
              role="status"
            >
              <Check className="size-4" aria-hidden="true" />
              {t('تم الربط بـ')} {label}
            </div>
          ) : (
            <Button
              key={id}
              type="button"
              variant={id === 'discord' ? 'default' : 'outline'}
              className={id === 'discord' ? 'gap-2 bg-discord text-discord-foreground hover:bg-discord-hover' : 'gap-2 bg-background'}
              disabled={isLoading || pending !== null}
              onClick={() => linkAccount(id)}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Icon />}
              {t('ربط')} {label}
            </Button>
          )
        })}
      </div>

      {providers.includes('discord') && (
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium" role="status" aria-live="polite">
              {syncStatus?.enabled ? (
                <Check className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
              {t('مزامنة ملف Discord')} — {t(syncStatus?.enabled ? 'المزامنة مفعّلة' : 'المزامنة متوقفة')}
            </div>
            <Button
              type="button"
              variant={syncStatus?.enabled ? 'outline' : 'default'}
              className="shrink-0 gap-2"
              disabled={syncPending || isSyncStatusLoading || Boolean(syncStatusError)}
              onClick={syncStatus?.enabled ? disableDiscordSync : enableDiscordSync}
            >
              {syncPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : syncStatus?.enabled ? (
                <Unlink className="size-4" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {t(syncPending ? 'جارٍ تحديث Discord…' : syncStatus?.enabled ? 'إيقاف المزامنة' : 'تفعيل المزامنة')}
            </Button>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('تُحدَّث الصورة والاسم فور التفعيل، ثم مرة يومياً ما دامت المزامنة مفعّلة.')}
          </p>
          {(syncError || syncStatusError) && (
            <p role="alert" className="text-sm text-destructive">
              {t('تعذّر تحديث ملف Discord أو حفظ حالة المزامنة. حاول مرة أخرى.')}
            </p>
          )}
        </div>
      )}

      {(linkError || error) && (
        <p role="alert" className="text-sm text-destructive">
          {t('تعذّر ربط الحساب. تأكد من تفعيل المزوّد وإعداد الربط اليدوي ثم حاول مجدداً.')}
        </p>
      )}

    </section>
  )
}
