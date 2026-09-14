'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, MessageSquare, Send, X, AlertTriangle } from 'lucide-react'

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

const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'مفتوحة', cls: 'bg-primary/20 text-primary' },
  pending_payment: { label: 'بانتظار الدفع', cls: 'bg-amber-500/15 text-amber-400' },
  resolved: { label: 'محلولة', cls: 'bg-muted text-muted-foreground' },
  disputed: { label: 'نزاع', cls: 'bg-destructive/15 text-destructive' },
  closed: { label: 'مغلقة', cls: 'bg-muted text-muted-foreground' },
}

export function TicketsList({ role }: { role: 'buyer' | 'seller' | 'admin' }) {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    let query = supabase.from('tickets').select('*').order('updated_at', { ascending: false })
    if (role === 'buyer') query = query.eq('buyer_id', user.id)
    else if (role === 'seller') query = query.eq('seller_id', user.id)
    const { data } = await query
    setTickets((data ?? []) as TicketRow[])
    setLoading(false)
  }, [user, role])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <p className="rounded-xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        لا توجد تذاكر.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {tickets.map((t) => {
        const st = TICKET_STATUS[t.status] ?? { label: t.status, cls: 'bg-muted text-muted-foreground' }
        return (
          <button
            key={t.id}
            onClick={() => setOpenId(t.id)}
            className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4 text-right transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                {t.type === 'dispute' ? <AlertTriangle className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
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
      })}

      {openId && <TicketThread ticketId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}

function TicketThread({
  ticketId,
  onClose,
  onChanged,
}: {
  ticketId: string
  onClose: () => void
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [ticket, setTicket] = useState<TicketRow | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [t, m] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', ticketId).single(),
      supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    ])
    setTicket((t.data as TicketRow) ?? null)
    setMessages((m.data ?? []) as MessageRow[])
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
          setMessages((prev) => [...prev, payload.new as MessageRow])
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

  async function openDispute() {
    if (!ticket) return
    const supabase = createClient()
    await supabase.from('tickets').update({ type: 'dispute', status: 'disputed' }).eq('id', ticketId)
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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border/60 bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div>
            <h2 className="font-bold">{ticket?.subject || 'تذكرة'}</h2>
            <p className="text-xs text-muted-foreground">رقم {ticketId.slice(0, 8)}</p>
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
          {ticket?.order_id && ticket.type !== 'dispute' && (
            <button
              onClick={openDispute}
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
