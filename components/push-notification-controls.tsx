'use client'

import { useEffect, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/auth/mock-auth'
import { useLocale } from '@/components/i18n/locale-provider'
import { Button } from '@/components/ui/button'
import {
  canUsePushApi,
  clearPushPromptDismissal,
  disableBrowserPush,
  enableBrowserPush,
  isPushPromptDue,
  pushErrorMessage,
  recordPushPromptDismissal,
} from '@/lib/push-notifications'

function copy(lang: 'ar' | 'en') {
  return lang === 'en'
    ? {
        title: 'Get ticket message alerts',
        description: 'Allow browser notifications so you can see new replies from the other person in your ticket, even when SwiftRBX is closed.',
        enable: 'Enable notifications',
        later: 'Not now',
        settingsTitle: 'Ticket message notifications',
        settingsDescription: 'Receive a browser notification when the other person replies to one of your tickets.',
        on: 'Enabled',
        off: 'Disabled',
        loading: 'Loading notification settings…',
        error: 'Notification settings could not be updated. Please try again.',
        unavailable: 'This browser does not support push notifications over the current connection.',
      }
    : {
        title: 'فعّل تنبيهات رسائل التذاكر',
        description: 'اسمح بإشعارات المتصفح لتصلك ردود الطرف الآخر على التذكرة حتى عند إغلاق SwiftRBX.',
        enable: 'تفعيل الإشعارات',
        later: 'ليس الآن',
        settingsTitle: 'إشعارات رسائل التذاكر',
        settingsDescription: 'استقبل إشعارًا من المتصفح عند رد الطرف الآخر على إحدى تذاكرك.',
        on: 'مفعّلة',
        off: 'متوقفة',
        loading: 'جارٍ تحميل إعدادات الإشعارات…',
        error: 'تعذّر تحديث إعدادات الإشعارات. حاول مرة أخرى.',
        unavailable: 'هذا المتصفح لا يدعم إشعارات الدفع عبر الاتصال الحالي.',
      }
}

export function PushNotificationPrompt() {
  const { user, ready } = useAuth()
  const { lang } = useLocale()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const text = copy(lang)

  useEffect(() => {
    if (!ready || !user || !canUsePushApi() || Notification.permission === 'denied') {
      setOpen(false)
      return
    }

    try {
      if (!isPushPromptDue(user.id)) {
        setOpen(false)
        return
      }
    } catch {
      setOpen(false)
      return
    }

    let cancelled = false
    fetch('/api/push-subscriptions', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<{ enabled?: boolean }>
      })
      .then((data) => {
        if (!cancelled) setOpen(!data?.enabled)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [ready, user?.id])

  function dismiss() {
    if (user) {
      try {
        recordPushPromptDismissal(user.id)
      } catch {
        // A blocked storage API should not prevent dismissing the dialog.
      }
    }
    setOpen(false)
    setError('')
  }

  async function enable() {
    setBusy(true)
    setError('')
    try {
      await enableBrowserPush()
      if (user) {
        try {
          recordPushPromptDismissal(user.id)
        } catch {
          // The enabled server preference prevents another prompt.
        }
      }
      setOpen(false)
    } catch (reason) {
      setError(pushErrorMessage(reason, lang))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={dismiss}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) dismiss()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-prompt-title"
        aria-describedby="push-prompt-description"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell aria-hidden="true" className="size-6" />
        </div>
        <h2 id="push-prompt-title" className="text-balance text-lg font-bold">{text.title}</h2>
        <p id="push-prompt-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {text.description}
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={dismiss} disabled={busy}>
            {text.later}
          </Button>
          <Button type="button" onClick={enable} disabled={busy}>
            {busy ? <Loader2 aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : <Bell aria-hidden="true" data-icon="inline-start" />}
            {text.enable}
          </Button>
        </div>
      </section>
    </div>
  )
}

export function PushNotificationSettings() {
  const { user } = useAuth()
  const { lang } = useLocale()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const text = copy(lang)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch('/api/push-subscriptions', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('settings')
        return response.json() as Promise<{ enabled?: boolean }>
      })
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data.enabled))
      })
      .catch(() => {
        if (!cancelled) {
          setEnabled(false)
          setError(text.error)
        }
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, text.error])

  async function toggle() {
    if (enabled === null || busy) return
    setBusy(true)
    setError('')
    try {
      if (enabled) {
        await disableBrowserPush()
        setEnabled(false)
      } else {
        if (!canUsePushApi()) throw new Error('unsupported')
        await enableBrowserPush()
        setEnabled(true)
        if (user) clearPushPromptDismissal(user.id)
      }
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'unsupported'
        ? text.unavailable
        : reason instanceof Error && reason.message !== 'settings'
          ? pushErrorMessage(reason, lang)
          : text.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border/60 bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Bell aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <h2 className="text-sm font-bold">{text.settingsTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text.settingsDescription}</p>
          {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      </div>
      <Button
        type="button"
        variant={enabled ? 'outline' : 'default'}
        onClick={toggle}
        disabled={enabled === null || busy}
        aria-pressed={Boolean(enabled)}
        className="shrink-0"
      >
        {busy || enabled === null
          ? <Loader2 aria-hidden="true" data-icon="inline-start" className="animate-spin" />
          : <Bell aria-hidden="true" data-icon="inline-start" />}
        {enabled === null ? text.loading : enabled ? text.on : text.off}
      </Button>
    </section>
  )
}
