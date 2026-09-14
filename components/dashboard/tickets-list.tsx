'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { createClient } from '@/lib/supabase/client'
import { StarInput } from '@/components/reviews/star-rating'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  MessageSquare,
  Send,
  X,
  AlertTriangle,
  Plus,
  PackageCheck,
  Star,
  ShieldCheck,
} from 'lucide-react'

type TicketRole = 'buyer' | 'seller' | 'admin' | 'support'

type TicketRow = {
  id: string
  type: string
  subject: string
  status: string
  buyer_id: string
  seller_id: string | null
  order_id: string | null
  created_at: string
}

type MessageRow = {
  id: string
  sender_id: string
  body: string
  created_at: string
}

type OrderRow = {
  id: string
  status: string
  robux_amount: number
  roblox_username: string
  seller_id: string | null
}

const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'مفتوحة', cls: 'bg-primary/20 text-primary' },
  pending_payment: { label: 'بانتظار الدفع', cls: 'bg-amber-500/15 text-amber-400' },
  delivered: { label: 'تم التسليم', cls: 'bg-sky-500/15 text-sky-400' },
  resolved: { label: 'محلولة', cls: 'bg-muted text-muted-foreground' },
  completed: { label: 'مكتملة', cls: 'bg-muted text-muted-foreground' },
  disputed: { label: 'نزاع', cls: 'bg-destructive/15 text-destructive' },
  closed: { label: 'مغلقة', cls: 'bg-muted text-muted-foreground' },
}

export function TicketsList({
  role,
  types,
  allowCreate = false,
}: {
  role: TicketRole
  types?: string[]
  allowCreate?: boolean
}) {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    let query = supabase.from('tickets').select('*').order('updated_at', { ascending: false })
    if (role === 'buyer') query = query.eq('buyer_id', user.id)
    else if (role === 'seller') query = query.eq('seller_id', user.id).neq('status', 'pending_payment')
    else if (role === 'support') query = query.in('type', ['support', 'dispute'])
    if (types && types.length) query = query.in('type', types)
    const { data } = await query
    setTickets((data ?? []) as TicketRow[])
    setLoading(false)
  }, [user, role, types])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-3">
      {allowCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" /> فتح تذكرة دعم جديدة
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
        </div>
      ) : tickets.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          لا توجد تذاكر.
        </p>
      ) : (
        tickets.map((t) => {
          const st = TICKET_STATUS[t.status] ?? { label: t.status, cls: 'bg-muted text-muted-foreground' }
          return (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4 text-right transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                  {t.type === 'dispute' ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : t.type === 'order' ? (
                    <PackageCheck className="h-5 w-5" />
                  ) : (
                    <MessageSquare className="h-5 w-5" />
                  )}
                </span>
                <div>
                  <div className="font-medium">{t.subject || 'تذكرة دعم'}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('ar')}
                  </div>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
            </button>
          )
        })
      )}

      {openId && (
        <TicketThread ticketId={openId} role={role} onClose={() => setOpenId(null)} onChanged={load} />
      )}
      {creating && (
        <NewSupportTicket
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            load()
            setOpenId(id)
          }}
        />
      )}
    </div>
  )
}

function NewSupportTicket({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { user } = useAuth()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!user || busy) return
    if (subject.trim().length < 3) return setError('اكتب عنواناً موجزاً للمشكلة')
    if (message.trim().length < 3) return setError('اكتب تفاصيل المشكلة')
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { data: ticket, error: err } = await supabase
      .from('tickets')
      .insert({ type: 'support', subject: subject.trim(), buyer_id: user.id, status: 'open' })
      .select()
      .single()
    if (err || !ticket) {
      setBusy(false)
      setError('تعذّر فتح التذكرة، حاول مرة أخرى')
      return
    }
    await supabase
      .from('ticket_messages')
      .insert({ ticket_id: ticket.id, sender_id: user.id, body: message.trim() })
    // إشعار فريق الدعم عبر Discord
    fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
    }).catch(() => {})
    setBusy(false)
    onCreated(ticket.id as string)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <MessageSquare className="h-5 w-5 text-primary" /> تذكرة دعم جديدة
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-subject">الموضوع</Label>
          <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: مشكلة في استلام الطلب" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-message">تفاصيل المشكلة</Label>
          <textarea
            id="t-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="اشرح مشكلتك بالتفصيل…"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={submit} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          إرسال التذكرة للدعم الفني
        </Button>
      </div>
    </div>
  )
}

function TicketThread({
  ticketId,
  role,
  onClose,
  onChanged,
}: {
  ticketId: string
  role: TicketRole
  onClose: () => void
  onChanged: () => void
}) {
  const { user, rateUser } = useAuth()
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [ticket, setTicket] = useState<TicketRow | null>(null)
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [sellerName, setSellerName] = useState<string>('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [acting, setActing] = useState(false)
  const [stars, setStars] = useState(0)
  const [showRating, setShowRating] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [t, m] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', ticketId).single(),
      supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    ])
    const tk = (t.data as TicketRow) ?? null
    setTicket(tk)
    setMessages((m.data ?? []) as MessageRow[])
    if (tk?.order_id) {
      const { data: o } = await supabase
        .from('orders')
        .select('id, status, robux_amount, roblox_username, seller_id')
        .eq('id', tk.order_id)
        .single()
      setOrder((o as OrderRow) ?? null)
    }
    if (tk?.seller_id) {
      const { data: s } = await supabase.from('profiles').select('username').eq('id', tk.seller_id).maybeSingle()
      setSellerName(s?.username ?? '')
    }
    setLoading(false)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [ticketId])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((x) => x.id === (payload.new as MessageRow).id) ? prev : [...prev, payload.new as MessageRow],
          )
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, load])

  async function send() {
    if (!text.trim() || !user || sending) return
    setSending(true)
    const body = text.trim()
    setText('')
    const supabase = createClient()
    await supabase.from('ticket_messages').insert({ ticket_id: ticketId, sender_id: user.id, body })
    await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)
    setSending(false)
  }

  async function postSystem(body: string) {
    if (!user) return
    const supabase = createClient()
    await supabase.from('ticket_messages').insert({ ticket_id: ticketId, sender_id: user.id, body })
  }

  // البائع: تأكيد تسليم الطلب
  async function markDelivered() {
    if (!order || acting) return
    setActing(true)
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', order.id)
    await supabase.from('tickets').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', ticketId)
    await postSystem(`قام البائع بتأكيد تسليم ${order.robux_amount.toLocaleString()} روبوكس إلى "${order.roblox_username}".`)
    await load()
    onChanged()
    setActing(false)
  }

  // المشتري: تأكيد الاستلام + التقييم
  async function confirmReceipt() {
    if (!order || acting) return
    if (stars < 1) {
      setShowRating(true)
      return
    }
    setActing(true)
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', order.id)
    await supabase.from('tickets').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', ticketId)
    if (sellerName) await rateUser(sellerName, stars)
    await postSystem(`أكد المشتري استلام الطلب وقيّم البائع بـ ${stars} من 5.`)
    await load()
    onChanged()
    setActing(false)
  }

  async function openDispute() {
    if (!ticket || acting) return
    setActing(true)
    const supabase = createClient()
    await supabase.from('tickets').update({ type: 'dispute', status: 'disputed' }).eq('id', ticketId)
    await postSystem('فتح المشتري نزاعاً على هذا الطلب وتحويله لفريق الدعم.')
    await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: `نزاع على تذكرة ${ticketId.slice(0, 8)}`,
        message: `فتح المستخدم نزاعاً على الطلب ${ticket.order_id ?? '-'}.`,
      }),
    }).catch(() => {})
    await load()
    onChanged()
    setActing(false)
  }

  const isOrderTicket = ticket?.type === 'order' || ticket?.type === 'dispute'
  const sellerCanDeliver = role === 'seller' && isOrderTicket && order?.status === 'processing'
  const buyerCanConfirm = role === 'buyer' && ticket?.type === 'order' && order?.status === 'delivered'
  const buyerCanDispute =
    role === 'buyer' && ticket?.order_id && ticket.type === 'order' && order?.status !== 'completed'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border/60 bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div>
            <h2 className="font-bold">{ticket?.subject || 'تذكرة'}</h2>
            <p className="text-xs text-muted-foreground">
              رقم {ticketId.slice(0, 8)}
              {sellerName && role !== 'seller' ? ` · البائع: ${sellerName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user?.id
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    }`}
                  >
                    {m.body}
                    <div className={`mt-1 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {new Date(m.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="space-y-2 border-t border-border/60 p-3">
          {sellerCanDeliver && (
            <Button onClick={markDelivered} disabled={acting} className="w-full gap-2">
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
              تأكيد تسليم الطلب
            </Button>
          )}

          {buyerCanConfirm && (
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Star className="h-3.5 w-3.5" /> استلمت طلبك؟ أكّد الاستلام وقيّم البائع
              </p>
              {(showRating || stars > 0) && (
                <div className="flex justify-center py-1">
                  <StarInput value={stars} onChange={setStars} />
                </div>
              )}
              <Button onClick={confirmReceipt} disabled={acting} className="w-full gap-2">
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {stars > 0 ? 'تأكيد الاستلام وإرسال التقييم' : 'تأكيد الاستلام والتقييم'}
              </Button>
            </div>
          )}

          {buyerCanDispute && ticket?.type !== 'dispute' && (
            <button
              onClick={openDispute}
              disabled={acting}
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> فتح نزاع على هذا الطلب
            </button>
          )}

          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="اكتب رسالتك…"
            />
            <Button onClick={send} disabled={sending || !text.trim()} size="icon">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
