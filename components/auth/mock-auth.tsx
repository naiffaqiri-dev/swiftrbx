'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type Role = 'owner' | 'seller' | 'support' | 'user'

export type ManagedUser = {
  id: string
  username: string
  email?: string
  role: Role
  balance: number
  active: boolean
  createdAt: number
  ratingSum?: number
  ratingCount?: number
  totalSales?: number
  commission?: number
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'إدارة عليا',
  seller: 'بائع / مورد',
  support: 'دعم فني',
  user: 'مستخدم',
}

const OWNER_USERNAMES = ['dego']

const STORAGE_SESSION = 'swiftrbx.session.v2'
const STORAGE_USERS = 'swiftrbx.users.v2'

function roleFor(username: string): Role {
  return OWNER_USERNAMES.includes(username.trim().toLowerCase()) ? 'owner' : 'user'
}

function seedUsers(): ManagedUser[] {
  const now = Date.now()
  const day = 1000 * 60 * 60 * 24
  return [
    { id: 'u_owner', username: 'dego', email: 'dego@swiftrbx.site', role: 'owner', balance: 0.08, active: true, createdAt: now - day * 30 },
    { id: 'u_seller1', username: 'ahmad_store', email: 'ahmad@swiftrbx.site', role: 'seller', balance: 1240, active: true, createdAt: now - day * 12, ratingSum: 47, ratingCount: 10, totalSales: 312, commission: 156 },
    { id: 'u_seller2', username: 'layla_robux', email: 'layla@swiftrbx.site', role: 'seller', balance: 860, active: true, createdAt: now - day * 6, ratingSum: 42, ratingCount: 9, totalSales: 189, commission: 94 },
    { id: 'u_support1', username: 'omar_support', email: 'omar@swiftrbx.site', role: 'support', balance: 0, active: true, createdAt: now - day * 9 },
    { id: 'u_support2', username: 'sara_help', email: 'sara@swiftrbx.site', role: 'support', balance: 0, active: false, createdAt: now - day * 3 },
    { id: 'u_user1', username: 'khalid', email: 'khalid@example.com', role: 'user', balance: 15, active: true, createdAt: now - day * 2 },
  ]
}

type AuthContextValue = {
  user: ManagedUser | null
  users: ManagedUser[]
  ready: boolean
  login: (username: string, email?: string) => void
  register: (username: string, email?: string) => void
  logout: () => void
  addStaff: (data: { username: string; email?: string; role: Role }) => void
  updateUser: (id: string, patch: Partial<ManagedUser>) => void
  removeUser: (id: string) => void
  rateUser: (username: string, stars: number) => void
}

export function ratingOf(u?: ManagedUser | null): { avg: number; count: number } {
  if (!u || !u.ratingCount) return { avg: 0, count: 0 }
  return { avg: +(u.ratingSum! / u.ratingCount).toFixed(1), count: u.ratingCount }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const rawUsers = localStorage.getItem(STORAGE_USERS)
      setUsers(rawUsers ? (JSON.parse(rawUsers) as ManagedUser[]) : seedUsers())
      const session = localStorage.getItem(STORAGE_SESSION)
      if (session) setUserId(session)
    } catch {
      setUsers(seedUsers())
    }
    setReady(true)
  }, [])

  const persistUsers = useCallback((next: ManagedUser[]) => {
    setUsers(next)
    try {
      localStorage.setItem(STORAGE_USERS, JSON.stringify(next))
    } catch {
      // تجاهل
    }
  }, [])

  const persistSession = useCallback((id: string | null) => {
    setUserId(id)
    try {
      if (id) localStorage.setItem(STORAGE_SESSION, id)
      else localStorage.removeItem(STORAGE_SESSION)
    } catch {
      // تجاهل
    }
  }, [])

  const upsertAndLogin = useCallback(
    (username: string, email?: string) => {
      const uname = username.trim()
      setUsers((prev) => {
        const existing = prev.find((u) => u.username.toLowerCase() === uname.toLowerCase())
        if (existing) {
          persistSession(existing.id)
          return prev
        }
        const created: ManagedUser = {
          id: `u_${Date.now()}`,
          username: uname,
          email,
          role: roleFor(uname),
          balance: 0,
          active: true,
          createdAt: Date.now(),
        }
        const next = [...prev, created]
        try {
          localStorage.setItem(STORAGE_USERS, JSON.stringify(next))
        } catch {
          // تجاهل
        }
        persistSession(created.id)
        return next
      })
    },
    [persistSession],
  )

  const logout = useCallback(() => persistSession(null), [persistSession])

  const addStaff = useCallback(
    (data: { username: string; email?: string; role: Role }) => {
      const created: ManagedUser = {
        id: `u_${Date.now()}`,
        username: data.username.trim(),
        email: data.email,
        role: data.role,
        balance: 0,
        active: true,
        createdAt: Date.now(),
      }
      persistUsers([...users, created])
    },
    [users, persistUsers],
  )

  const updateUser = useCallback(
    (id: string, patch: Partial<ManagedUser>) => {
      persistUsers(users.map((u) => (u.id === id ? { ...u, ...patch } : u)))
    },
    [users, persistUsers],
  )

  const removeUser = useCallback(
    (id: string) => {
      persistUsers(users.filter((u) => u.id !== id))
      if (userId === id) persistSession(null)
    },
    [users, persistUsers, userId, persistSession],
  )

  const rateUser = useCallback(
    (username: string, stars: number) => {
      const clamped = Math.max(1, Math.min(5, Math.round(stars)))
      persistUsers(
        users.map((u) =>
          u.username.toLowerCase() === username.toLowerCase()
            ? {
                ...u,
                ratingSum: (u.ratingSum ?? 0) + clamped,
                ratingCount: (u.ratingCount ?? 0) + 1,
              }
            : u,
        ),
      )
    },
    [users, persistUsers],
  )

  const user = users.find((u) => u.id === userId) ?? null

  const value = useMemo(
    () => ({
      user,
      users,
      ready,
      login: upsertAndLogin,
      register: upsertAndLogin,
      logout,
      addStaff,
      updateUser,
      removeUser,
      rateUser,
    }),
    [user, users, ready, upsertAndLogin, logout, addStaff, updateUser, removeUser, rateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth يجب استخدامه داخل AuthProvider')
  return ctx
}
