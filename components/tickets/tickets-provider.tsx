'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type TicketStatus = 'open' | 'closed'

export type TicketMessage = {
  id: string
  author: string
  role: string
  body: string
  at: number
}

export type Ticket = {
  id: string
  subject: string
  buyer: string
  seller: string
  status: TicketStatus
  amount: number
  delivery: string
  price: number
  createdAt: number
  messages: TicketMessage[]
}

const STORAGE_TICKETS = 'swiftrbx.tickets.v1'

function seedTickets(): Ticket[] {
  const now = Date.now()
  const hr = 1000 * 60 * 60
  return [
    {
      id: 'T-1042',
      subject: 'طلب 5,000 روبوكس',
      buyer: 'khalid',
      seller: 'ahmad_store',
      status: 'open',
      amount: 5000,
      delivery: 'تسليم عبر المجموعة (Group Payout)',
      price: 21,
      createdAt: now - hr * 2,
      messages: [
        { id: 'm1', author: 'khalid', role: 'user', body: 'السلام عليكم، متى يوصل الطلب؟', at: now - hr * 2 },
        { id: 'm2', author: 'omar_support', role: 'support', body: 'وعليكم السلام، جاري التنفيذ مع البائع الآن.', at: now - hr * 1.5 },
      ],
    },
    {
      id: 'T-1039',
      subject: 'مشكلة في التسليم',
      buyer: 'noor',
      seller: 'layla_robux',
      status: 'open',
      amount: 2000,
      delivery: 'تسليم عبر Gamepass',
      price: 9,
      createdAt: now - hr * 20,
      messages: [
        { id: 'm3', author: 'noor', role: 'user', body: 'لم يصلني الروبوكس بعد.', at: now - hr * 20 },
      ],
    },
  ]
}

type TicketsContextValue = {
  tickets: Ticket[]
  ready: boolean
  createTicket: (data: Omit<Ticket, 'id' | 'createdAt' | 'status' | 'messages'> & { firstMessage?: TicketMessage }) => Ticket
  addMessage: (ticketId: string, msg: Omit<TicketMessage, 'id' | 'at'>) => void
  setStatus: (ticketId: string, status: TicketStatus) => void
}

const TicketsContext = createContext<TicketsContextValue | null>(null)

async function notifyDiscord(channel: string, content: string) {
  try {
    await fetch('/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, content }),
    })
  } catch {
    // تجاهل فشل الإشعار
  }
}

export function TicketsProvider({ children }: { children: React.ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_TICKETS)
      setTickets(raw ? (JSON.parse(raw) as Ticket[]) : seedTickets())
    } catch {
      setTickets(seedTickets())
    }
    setReady(true)
  }, [])

  const persist = useCallback((next: Ticket[]) => {
    setTickets(next)
    try {
      localStorage.setItem(STORAGE_TICKETS, JSON.stringify(next))
    } catch {
      // تجاهل
    }
  }, [])

  const createTicket = useCallback<TicketsContextValue['createTicket']>(
    (data) => {
      const id = `T-${Math.floor(1000 + Math.random() * 9000)}`
      const ticket: Ticket = {
        id,
        subject: data.subject,
        buyer: data.buyer,
        seller: data.seller,
        status: 'open',
        amount: data.amount,
        delivery: data.delivery,
        price: data.price,
        createdAt: Date.now(),
        messages: data.firstMessage ? [data.firstMessage] : [],
      }
      setTickets((prev) => {
        const next = [ticket, ...prev]
        try {
          localStorage.setItem(STORAGE_TICKETS, JSON.stringify(next))
        } catch {
          // تجاهل
        }
        return next
      })
      notifyDiscord(
        'orders',
        `**طلب جديد** ${id}\nالمشتري: ${data.buyer}\nالبائع: ${data.seller}\nالكمية: ${data.amount.toLocaleString()} R$\nالتسليم: ${data.delivery}\nالسعر: ${data.price}$`,
      )
      return ticket
    },
    [],
  )

  const addMessage = useCallback<TicketsContextValue['addMessage']>(
    (ticketId, msg) => {
      setTickets((prev) => {
        const next = prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                messages: [
                  ...t.messages,
                  { ...msg, id: `m_${Date.now()}`, at: Date.now() },
                ],
              }
            : t,
        )
        try {
          localStorage.setItem(STORAGE_TICKETS, JSON.stringify(next))
        } catch {
          // تجاهل
        }
        return next
      })
      const channel = msg.role === 'support' || msg.role === 'owner' ? 'support' : 'suppliers_support'
      notifyDiscord(channel, `**رسالة في** ${ticketId}\n${msg.author} (${msg.role}): ${msg.body}`)
    },
    [],
  )

  const setStatus = useCallback<TicketsContextValue['setStatus']>(
    (ticketId, status) => {
      setTickets((prev) => {
        const next = prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
        try {
          localStorage.setItem(STORAGE_TICKETS, JSON.stringify(next))
        } catch {
          // تجاهل
        }
        return next
      })
    },
    [],
  )

  const value = useMemo(
    () => ({ tickets, ready, createTicket, addMessage, setStatus }),
    [tickets, ready, createTicket, addMessage, setStatus],
  )

  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>
}

export function useTickets() {
  const ctx = useContext(TicketsContext)
  if (!ctx) throw new Error('useTickets يجب استخدامه داخل TicketsProvider')
  return ctx
}
