'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, ROLE_LABELS } from '@/components/auth/mock-auth'
import { useTickets } from '@/components/tickets/tickets-provider'
import { StarInput } from '@/components/reviews/star-rating'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, Send, Lock, Unlock, Store, User as UserIcon, CheckCircle2 } from 'lucide-react'

function timeAgo(at: number) {
  const diff = Math.floor((Date.now() - at) / 60000)
  if (diff < 1) return 'الآن'
  if (diff < 60) return `قبل ${diff} د`
  const h = Math.floor(diff / 60)
  if (h < 24) return `قبل ${h} س`
  return `قبل ${Math.floor(h / 24)} يوم`
}

export function TicketChat({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const { user, ready: authReady } = useAuth()
  const { tickets, ready, addMessage, setStatus } = useTickets()
  const { rateUser } = useAuth()
  const [body, setBody] = useState('')
  const [myStars, setMyStars] = useState(0)
  const [rated, setRated] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const ticket = tickets.find((t) => t.id === ticketId)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket?.messages.length])

  useEffect(() => {
    if (authReady && !user) router.replace('/login')
  }, [authReady, user, router])

  if (!ready || !authReady) {
    return <p className="p-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
  }

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
        <p className="text-muted-foreground">التذكرة غير موجودة.</p>
        <Button className="mt-4" onClick={() => router.push('/tickets')}>
          كل التذاكر
        </Button>
      </div>
    )
  }

  const isStaff = user?.role === 'owner' || user?.role === 'support'
  const canClose = isStaff || user?.username === ticket.buyer

  function send(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || !user) return
    addMessage(ticket.id, { author: user.username, role: user.role, body: body.trim() })
    setBody('')
  }

  const isBuyer = user?.username === ticket.buyer
  const isSeller = user?.username === ticket.seller
  const target = isBuyer ? ticket.seller : ticket.buyer
  const targetLabel = isBuyer ? 'البائع' : 'المشتري'
  const canRate = ticket.status === 'closed' && (isBuyer || isSeller)

  function submitRating() {
    if (!myStars) return
    rateUser(target, myStars)
    setRated(true)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/tickets')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          كل التذاكر
        </button>
        {canClose && (
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => setStatus(ticket.id, ticket.status === 'open' ? 'closed' : 'open')}
          >
            {ticket.status === 'open' ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            {ticket.status === 'open' ? 'إغلاق التذكرة' : 'إعادة فتح'}
          </Button>
        )}
      </div>

      {/* رأس التذكرة */}
      <div className="rounded-t-2xl border border-b-0 border-border/60 bg-card/40 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">
              {ticket.subject} <span className="text-sm font-normal text-muted-foreground">#{ticket.id}</span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5" /> {ticket.buyer}
              </span>
              <span className="flex items-center gap-1">
                <Store className="h-3.5 w-3.5" /> {ticket.seller}
              </span>
              <span>{ticket.amount.toLocaleString()} R$ · {ticket.price}$</span>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              ticket.status === 'open' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            {ticket.status === 'open' ? 'مفتوحة' : 'مغلقة'}
          </span>
        </div>
      </div>

      {/* الرسائل */}
      <div className="h-[420px] space-y-4 overflow-y-auto border-x border-border/60 bg-background/40 p-5">
        {ticket.messages.map((m) => {
          const mine = m.author === user?.username
          const system = m.role === 'system'
          if (system) {
            return (
              <div key={m.id} className="text-center">
                <span className="rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground">{m.body}</span>
              </div>
            )
          }
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-primary/15' : 'bg-card border border-border/60'}`}>
                <div className="mb-0.5 flex items-center gap-2 text-xs">
                  <span className="font-medium">{m.author}</span>
                  <span className="text-muted-foreground">{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? ''}</span>
                </div>
                <p className="text-sm leading-relaxed">{m.body}</p>
                <div className="mt-1 text-left text-[10px] text-muted-foreground">{timeAgo(m.at)}</div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* لوحة التقييم المزدوج بعد إغلاق التذكرة */}
      {canRate && (
        <div className="border-x border-border/60 bg-primary/5 p-5">
          {rated ? (
            <div className="flex items-center justify-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              شكراً! تم تسجيل تقييمك لـ {target}.
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm font-medium">
                قيّم تعاملك مع {targetLabel} <span className="text-primary">{target}</span>
              </p>
              <StarInput value={myStars} onChange={setMyStars} />
              <Button size="sm" disabled={!myStars} onClick={submitRating}>
                إرسال التقييم
              </Button>
            </div>
          )}
        </div>
      )}

      {/* إدخال الرسالة */}
      <form onSubmit={send} className="flex gap-2 rounded-b-2xl border border-t-0 border-border/60 bg-card/40 p-4">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={ticket.status === 'open' ? 'اكتب رسالتك…' : 'التذكرة مغلقة'}
          disabled={ticket.status === 'closed'}
        />
        <Button type="submit" size="icon" disabled={ticket.status === 'closed' || !body.trim()}>
          <Send className="h-4 w-4" />
          <span className="sr-only">إرسال</span>
        </Button>
      </form>
    </div>
  )
}
