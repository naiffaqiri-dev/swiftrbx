'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { createClient } from '@/lib/supabase/client'
import { StarInput } from '@/components/reviews/star-rating'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProfileAvatar } from '@/components/profile-avatar'
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
  Paperclip,
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
  close_reason: string | null
  catalog_item_id: string | null
  catalog_quantity: number | null
  purchase_price_sar: number | null
  created_at: string
}

type MessageRow = {
  id: string
  sender_id: string
  body: string
  created_at: string
}

type SenderProfile = {
  id: string
  username: string
  avatar_url: string | null
}

type OrderRow = {
  id: string
  status: string
  robux_amount: number
  roblox_username: string
  seller_id: string | null
  delivered_at: string | null
  close_reason: string | null
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
  statuses,
  onlyRejectedTransfers = false,
  allowCreate = false,
}: {
  role: TicketRole
  types?: string[]
  statuses?: string[]
  onlyRejectedTransfers?: boolean
  allowCreate?: boolean
}) {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const typeFilter = types?.join('|')
  const statusFilter = statuses?.join('|')

  const load = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    let query = supabase.from('tickets').select('*').order('updated_at', { ascending: false })
    if (role === 'buyer') query = query.eq('buyer_id', user.id)
    else if (role === 'seller') query = query.eq('seller_id', user.id).neq('status', 'pending_payment')
    else if (role === 'support') query = query.in('type', ['support', 'dispute'])
    if (typeFilter) query = query.in('type', typeFilter.split('|'))
    if (statusFilter) query = query.in('status', statusFilter.split('|'))
    if (onlyRejectedTransfers) {
      query = query.eq('type', 'order').eq('status', 'closed').not('order_id', 'is', null)
    }
    const { data } = await query
    let visibleTickets = (data ?? []) as TicketRow[]
    if (onlyRejectedTransfers && visibleTickets.length > 0) {
      const orderIds = [...new Set(visibleTickets.map((ticket) => ticket.order_id).filter((id): id is string => Boolean(id)))]
      const { data: rejectedOrders } = await supabase
        .from('orders')
        .select('id')
        .in('id', orderIds)
        .eq('status', 'rejected')
      const rejectedOrderIds = new Set((rejectedOrders ?? []).map((order) => order.id))
      visibleTickets = visibleTickets.filter((ticket) => ticket.order_id && rejectedOrderIds.has(ticket.order_id))
    }
    setTickets(visibleTickets)
    setLoading(false)
  }, [user, role, typeFilter, statusFilter, onlyRejectedTransfers])

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
          {onlyRejectedTransfers ? 'لا توجد تذاكر لطلبات مرفوضة.' : statusFilter ? 'لا توجد تذاكر نشطة.' : 'لا توجد تذاكر.'}
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
    // إشعار ��ريق الدعم عبر Discord
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

function renderLinkedText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const urlPattern = /https?:\/\/[^\s<]+/gi
  let cursor = 0
  let linkIndex = 0

  for (const match of text.matchAll(urlPattern)) {
    const start = match.index ?? 0
    const rawUrl = match[0]
    const url = rawUrl.replace(/[.,!?;:)\]}،؟]+$/u, '')
    if (!url) continue

    nodes.push(text.slice(cursor, start))
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        nodes.push(
          <a
            key={`${keyPrefix}-link-${linkIndex++}`}
            href={parsedUrl.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-link underline decoration-link/50 underline-offset-2 hover:decoration-link"
          >
            {url}
          </a>,
        )
      } else {
        nodes.push(url)
      }
    } catch {
      nodes.push(url)
    }
    nodes.push(rawUrl.slice(url.length))
    cursor = start + rawUrl.length
  }

  nodes.push(text.slice(cursor))
  return nodes
}

function renderMessageBody(body: string, ticketId: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const attachmentPattern = /\[\[ticket-image:([^\]]+)\]\]/g
  let cursor = 0
  let attachmentIndex = 0

  for (const match of body.matchAll(attachmentPattern)) {
    const start = match.index ?? 0
    const pathname = match[1]
    nodes.push(...renderLinkedText(body.slice(cursor, start), `message-${start}`))
    const imageUrl = `/api/tickets/${encodeURIComponent(ticketId)}/attachments?pathname=${encodeURIComponent(pathname)}`
    nodes.push(
      <a
        key={`attachment-${attachmentIndex++}`}
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block w-fit"
      >
        <img
          src={imageUrl}
          alt="صورة مرفقة في محادثة الطلب"
          className="max-h-64 max-w-full rounded-lg border border-border object-contain"
        />
      </a>,
    )
    cursor = start + match[0].length
  }

  nodes.push(...renderLinkedText(body.slice(cursor), `message-${cursor}`))
  return nodes
}

export function TicketThread({
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
  const { user } = useAuth()
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [senderProfiles, setSenderProfiles] = useState<Record<string, SenderProfile>>({})
  const [ticket, setTicket] = useState<TicketRow | null>(null)
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [sellerName, setSellerName] = useState<string>('')
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [acting, setActing] = useState(false)
  const [stars, setStars] = useState(0)
  const [showRating, setShowRating] = useState(false)
  const [reviewComment, setReviewComment] = useState('')
  const [actionError, setActionError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [t, m] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', ticketId).single(),
      supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    ])
    const tk = (t.data as TicketRow) ?? null
    const loadedMessages = (m.data ?? []) as MessageRow[]
    setTicket(tk)
    setMessages(loadedMessages)

    const senderIds = [...new Set(loadedMessages.map((message) => message.sender_id))]
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', senderIds)
      setSenderProfiles(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile as SenderProfile])))
    } else {
      setSenderProfiles({})
    }

    if (tk?.order_id) {
      const { data: o } = await supabase
        .from('orders')
        .select('id, status, robux_amount, roblox_username, seller_id, delivered_at, close_reason')
        .eq('id', tk.order_id)
        .single()
      const ord = (o as OrderRow) ?? null
      setOrder(ord)
      // إكمال تلقائي إذا مرّت 30 دقيقة على التسليم دون تأكيد المشتري
      if (
        ord?.status === 'delivered' &&
        ord.delivered_at &&
        Date.now() - Date.parse(ord.delivered_at) >= 30 * 60 * 1000
      ) {
        await fetch('/api/orders/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: ord.id, action: 'auto_complete' }),
        }).catch(() => {})
      }
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
          const message = payload.new as MessageRow
          setMessages((prev) => (prev.some((x) => x.id === message.id) ? prev : [...prev, message]))
          void supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', message.sender_id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setSenderProfiles((prev) => ({ ...prev, [data.id]: data as SenderProfile }))
              }
            })
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, load])

  async function send() {
    if ((!text.trim() && !attachment) || !user || sending) return
    setSending(true)
    setActionError('')
    let body = text.trim()

    if (attachment) {
      const formData = new FormData()
      formData.set('file', attachment)
      const upload = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/attachments`, {
        method: 'POST',
        body: formData,
      })
      const result = await upload.json().catch(() => ({}))
      if (!upload.ok || typeof result.pathname !== 'string') {
        setActionError(result.error ?? 'تعذّر إرفاق الصورة، حاول مرة أخرى')
        setSending(false)
        return
      }
      body = [body, `[[ticket-image:${result.pathname}]]`].filter(Boolean).join('\n')
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: ticketId, sender_id: user.id, body })
    if (error) {
      setActionError('تعذّر إرسال الرسالة، حاول مرة أخرى')
      setSending(false)
      return
    }
    await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)
    setText('')
    setAttachment(null)
    setSending(false)
  }

  async function postSystem(body: string) {
    if (!user) return
    const supabase = createClient()
    await supabase.from('ticket_messages').insert({ ticket_id: ticketId, sender_id: user.id, body })
  }

  async function orderAction(action: string, extra?: Record<string, unknown>) {
    if (!order) return false
    const res = await fetch('/api/orders/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, action, ...extra }),
    })
    return res.ok
  }

  async function catalogTicketAction(action: 'deliver' | 'confirm', extra?: Record<string, unknown>) {
    const res = await fetch('/api/catalog/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, action, ...extra }),
    })
    if (!res.ok) {
      const result = await res.json().catch(() => ({}))
      setActionError(result.error ?? 'تعذّر تحديث الطلب')
      return false
    }
    setActionError('')
    return true
  }

  // البا��ع: تأكيد تسليم الطلب (يضيف الرصيد القابل للسحب للبائع فوراً على الخادم)
  async function markDelivered() {
    if (acting) return
    setActing(true)
    if (ticket?.catalog_item_id) {
      await catalogTicketAction('deliver')
    } else if (order) {
      const ok = await orderAction('deliver')
      if (ok) await postSystem(`قام البائع بتأكيد تسليم ${order.robux_amount.toLocaleString()} روبوكس إلى "${order.roblox_username}".`)
    }
    await load()
    onChanged()
    setActing(false)
  }

  // المشتري: تأكيد الاستلام + التقييم المتبادل
  async function confirmReceipt() {
    if ((!order && !ticket?.catalog_item_id) || acting) return
    if (stars < 1) {
      setShowRating(true)
      return
    }
    setActing(true)
    if (ticket?.catalog_item_id) {
      await catalogTicketAction('confirm', { rating: stars, comment: reviewComment.trim() })
    } else if (order) {
      const ok = await orderAction('confirm', { rating: stars, comment: reviewComment.trim() })
      if (ok) await postSystem(`أكد المشتري استلام الطلب وقيّم البائع بـ ${stars} من 5.`)
    }
    await load()
    onChanged()
    setActing(false)
  }

  async function openDispute() {
    if (!ticket || acting) return
    setActing(true)
    const ok = await orderAction('dispute')
    if (ok) await postSystem('فتح المشتري نزاعاً على هذا الطلب وتحويله لفريق الدعم.')
    await load()
    onChanged()
    setActing(false)
  }

  const isOrderTicket = ticket?.type === 'order' || ticket?.type === 'dispute'
  const sellerCanDeliver = role === 'seller' && isOrderTicket && (order?.status === 'processing' || (Boolean(ticket?.catalog_item_id) && ticket?.status === 'open'))
  const buyerCanConfirm = role === 'buyer' && ticket?.type === 'order' && (order?.status === 'delivered' || (Boolean(ticket?.catalog_item_id) && ticket?.status === 'delivered'))
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
              {ticket?.catalog_item_id ? ` · الكمية: ${Number(ticket.catalog_quantity ?? 1).toLocaleString('ar-SA')}` : ''}
              {ticket?.purchase_price_sar !== null && ticket?.purchase_price_sar !== undefined ? ` · ${Number(ticket.purchase_price_sar).toFixed(2)} ر.س` : ''}
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
              const profile = senderProfiles[m.sender_id]
              const senderName = profile?.username ?? (mine ? user?.username : undefined) ?? 'مستخدم'
              const avatarUrl = profile?.avatar_url ?? (mine ? user?.avatarUrl : undefined)
              return (
                <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {mine && (
                    <div className="max-w-[80%] rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                      <div className="mb-1 text-xs font-semibold">{senderName}</div>
                      <p className="whitespace-pre-wrap break-words">{renderMessageBody(m.body, ticketId)}</p>
                      <div className="mt-1 text-[10px] text-primary-foreground/70">
                        {new Date(m.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                  <ProfileAvatar
                    src={avatarUrl}
                    name={senderName}
                    alt={`الصورة الشخصية لـ ${senderName}`}
                    className="size-8 border border-border/60 text-[10px]"
                  />
                  {!mine && (
                    <div className="max-w-[80%] rounded-2xl bg-muted px-3.5 py-2 text-sm text-foreground">
                      <div className="mb-1 text-xs font-semibold">{senderName}</div>
                      <p className="whitespace-pre-wrap break-words">{renderMessageBody(m.body, ticketId)}</p>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="space-y-2 border-t border-border/60 p-3">
          {actionError && <p role="alert" className="text-xs text-destructive">{actionError}</p>}
          {(ticket?.status === 'closed' || order?.status === 'rejected') &&
            (ticket?.close_reason || order?.close_reason) && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>سبب الإغلاق: {ticket?.close_reason || order?.close_reason}</span>
              </div>
            )}

          {sellerCanDeliver && (
            <Button onClick={markDelivered} disabled={acting} className="w-full gap-2">
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
              {ticket?.catalog_item_id ? 'تأكيد تسليم المنتج للمشتري' : 'تأكيد تسليم الطلب'}
            </Button>
          )}

          {buyerCanConfirm && (
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Star className="h-3.5 w-3.5" /> استلمت {ticket?.catalog_item_id ? 'المنتج' : 'طلبك'}؟ أكّد الاستلام وقيّم البائع
              </p>
              {(showRating || stars > 0) && (
                <div className="space-y-2 py-1">
                  <div className="flex justify-center">
                    <StarInput value={stars} onChange={setStars} />
                  </div>
                  <Input
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="أضف تعليقاً على تجربتك مع البائع (اختياري)"
                  />
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

          {attachment && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs">
              <span className="min-w-0 truncate">الصورة المرفقة: {attachment.name}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                disabled={sending}
                aria-label="إزالة الصورة المرفقة"
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="sr-only"
              aria-label="اختر صورة لإرفاقها بالتذكرة"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null
                event.currentTarget.value = ''
                if (!file) return
                if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) {
                  setActionError('اختر صورة بصيغة PNG أو JPG أو WEBP أو GIF أو AVIF')
                  return
                }
                if (file.size > 8 * 1024 * 1024) {
                  setActionError('حجم الصورة يجب ألا يتجاوز 8 ميغابايت')
                  return
                }
                setActionError('')
                setAttachment(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={sending}
            >
              <Paperclip className="size-4" />
              إرفاق صورة
            </Button>
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
            <Button onClick={send} disabled={sending || (!text.trim() && !attachment)} size="icon" aria-label="إرسال الرسالة">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
