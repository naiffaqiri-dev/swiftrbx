'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'

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

type ProfileRow = {
  id: string
  username: string
  email: string | null
  role: Role
  balance: string | number
  active: boolean
  rating: string | number
  rating_count: number
  sales: number
  commission: string | number
  created_at: string
}

function mapRow(r: ProfileRow): ManagedUser {
  const count = r.rating_count ?? 0
  const avg = Number(r.rating ?? 0)
  return {
    id: r.id,
    username: r.username,
    email: r.email ?? undefined,
    role: r.role,
    balance: Number(r.balance ?? 0),
    active: r.active,
    createdAt: Date.parse(r.created_at) || Date.now(),
    ratingCount: count,
    ratingSum: Math.round(avg * count),
    totalSales: r.sales ?? 0,
    commission: Number(r.commission ?? 0),
  }
}

export function ratingOf(u?: ManagedUser | null): { avg: number; count: number } {
  if (!u || !u.ratingCount) return { avg: 0, count: 0 }
  return { avg: +(u.ratingSum! / u.ratingCount).toFixed(1), count: u.ratingCount }
}

type AuthContextValue = {
  user: ManagedUser | null
  users: ManagedUser[]
  ready: boolean
  login: (identifier: string, password: string) => Promise<{ error?: string }>
  register: (data: {
    username: string
    email?: string
    password: string
  }) => Promise<{ error?: string }>
  logout: () => Promise<void>
  addStaff: (data: {
    username: string
    email?: string
    role: Role
  }) => Promise<{ error?: string; tempPassword?: string; email?: string }>
  updateUser: (id: string, patch: Partial<ManagedUser>) => Promise<void>
  removeUser: (id: string) => Promise<void>
  rateUser: (username: string, stars: number) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const PROFILE_COLUMNS =
  'id, username, email, role, balance, active, rating, rating_count, sales, commission, created_at'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const refreshUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('created_at', { ascending: true })
    if (data) setUsers((data as ProfileRow[]).map(mapRow))
  }, [supabase])

  useEffect(() => {
    let activeSub = true

    async function boot() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!activeSub) return
      setUserId(user?.id ?? null)
      if (user) await refreshUsers()
      setReady(true)
    }
    boot()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      if (session?.user) {
        refreshUsers()
      } else {
        setUsers([])
      }
    })

    return () => {
      activeSub = false
      subscription.unsubscribe()
    }
  }, [supabase, refreshUsers])

  const login = useCallback(
    async (identifier: string, password: string) => {
      const id = identifier.trim()
      if (!id || !password) return { error: 'يرجى إدخال البيانات كاملة' }

      // تحويل اسم المستخدم إلى البريد المرتبط به
      let email = id
      if (!id.includes('@')) {
        const res = await fetch('/api/auth/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: id }),
        })
        if (!res.ok) return { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
        const json = await res.json()
        email = json.email
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      })
      if (error) return { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }

      await refreshUsers()
      return {}
    },
    [supabase, refreshUsers],
  )

  const register = useCallback(
    async (data: { username: string; email?: string; password: string }) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return { error: json.error ?? 'تعذّر إنشاء الحساب' }

      // تسجيل الدخول مباشرة بعد الإنشاء (الحساب مؤكّد البريد)
      const { error } = await supabase.auth.signInWithPassword({
        email: json.email,
        password: data.password,
      })
      if (error) return { error: 'تم إنشاء الحساب، لكن تعذّر تسجيل الدخول التلقائي' }

      await refreshUsers()
      return {}
    },
    [supabase, refreshUsers],
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUserId(null)
    setUsers([])
  }, [supabase])

  const addStaff = useCallback(
    async (data: { username: string; email?: string; role: Role }) => {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return { error: json.error ?? 'تعذّر إضافة الموظف' }
      await refreshUsers()
      return { tempPassword: json.tempPassword, email: json.email }
    },
    [refreshUsers],
  )

  const updateUser = useCallback(
    async (id: string, patch: Partial<ManagedUser>) => {
      const dbPatch: Record<string, unknown> = {}
      if (patch.email !== undefined) dbPatch.email = patch.email
      if (patch.active !== undefined) dbPatch.active = patch.active
      if (patch.role !== undefined) dbPatch.role = patch.role
      if (patch.balance !== undefined) dbPatch.balance = patch.balance
      if (Object.keys(dbPatch).length === 0) return

      // تحديث فوري متفائل
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
      await supabase.from('profiles').update(dbPatch).eq('id', id)
      await refreshUsers()
    },
    [supabase, refreshUsers],
  )

  const removeUser = useCallback(
    async (id: string) => {
      setUsers((prev) => prev.filter((u) => u.id !== id))
      await supabase.from('profiles').delete().eq('id', id)
      await refreshUsers()
    },
    [supabase, refreshUsers],
  )

  const rateUser = useCallback(
    async (username: string, stars: number) => {
      const clamped = Math.max(1, Math.min(5, Math.round(stars)))
      await supabase.rpc('rate_user', { p_username: username, p_stars: clamped })
      await refreshUsers()
    },
    [supabase, refreshUsers],
  )

  const user = users.find((u) => u.id === userId) ?? null

  const value = useMemo(
    () => ({
      user,
      users,
      ready,
      login,
      register,
      logout,
      addStaff,
      updateUser,
      removeUser,
      rateUser,
    }),
    [user, users, ready, login, register, logout, addStaff, updateUser, removeUser, rateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth يجب استخدامه داخل AuthProvider')
  return ctx
}
