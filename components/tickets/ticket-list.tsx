'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/mock-auth'
import { useTickets } from '@/components/tickets/tickets-provider'
import { MessageSquare, Store, User as UserIcon } from 'lucide-react'

export function TicketList() {
  const router = useRouter()
  const { user, ready: authReady } = useAuth()
  const { tickets, ready } = useTickets()

  useEffect(() => {
    if (authReady && !user) router.replace('/login')
  }, [authReady, user, router])

  if (!ready || !authReady || !user) {
    return <p className="p-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
  }

  const isStaff = user.role === 'owner' || user.role === 'support'
  const visible = isStaff
    ? tickets
    : tickets.filter((t) => t.buyer === user.username || t.seller === user.username)

  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
        لا توجد تذاكر بعد.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {visible.map((t) => (
        <Link
          key={t.id}
          href={`/tickets/${t.id}`}
          className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium">
                {t.subject} <span className="text-xs text-muted-foreground">#{t.id}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3 w-3" /> {t.buyer}
                </span>
                <span className="flex items-center gap-1">
                  <Store className="h-3 w-3" /> {t.seller}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{t.messages.length} رسالة</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                t.status === 'open' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              {t.status === 'open' ? 'مفتوحة' : 'مغلقة'}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
