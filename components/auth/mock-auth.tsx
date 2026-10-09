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
import { sellerPermissions as normalizeSellerPermissions, type CatalogCategory } from '@/lib/catalog'

export type Role = 'owner' | 'seller' | 'support' | 'user'

export type ManagedUser = {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string
  email?: string
  role: Role
  balance: number
  active: boolean
  createdAt: number
  ratingSum?: number
  ratingCount?: number
  totalSales?: number
  commission?: number
  referralCode?: string
  twoFactorEnabled?: boolean
  onboarded?: boolean
  usernameChangedAt?: number | null
  displayNameChangedAt?: number | null
  sellerPermissions: CatalogCategory[]
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
  display_name: string | null
  avatar_url: string | null
  role: Role
  rating: string | number
  rating_count: number
  sales: number
  active: boolean
  created_at: string
  seller_permissions?: unknown
}

type OwnPrivateProfile = {
  id: string
  email: string | null
  balance: string | number
  commission: string | number
  two_factor_enabled: boolean | null
  referral_code: string | null
}

type AdminPrivateProfile = {
  id: string
  email: string | null
  balance: string | number
}

function mapRow(r: ProfileRow): ManagedUser {
  const count = r.rating_count ?? 0
  const avg = Number(r.rating ?? 0)
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    role: r.role,
    balance: 0,
    active: r.active,
    createdAt: Date.parse(r.created_at) || Date.now(),
    ratingCount: count,
    ratingSum: Math.round(avg * count),
    totalSales: r.sales ?? 0,
    sellerPermissions: normalizeSellerPermissions(r.seller_permissions),
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
  refreshUsers: () => Promise<void>
  refresh: () => Promise<void>
  login: (identifier: string, password: string) => Promise<{ error?: string }>
  register: (data: {
    username: string
    displayName?: string
    email?: string
    password: string
    privacyPolicyAccepted: boolean
    termsOfUseAccepted: boolean
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
  'id, username, display_name, avatar_url, role, seller_permissions, rating, rating_count, sales, active, created_at'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const refreshUsers = useCallback(async (currentUserId?: string) => {
    let authenticatedUserId = currentUserId
    if (!authenticatedUserId) {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      authenticatedUserId = currentUser?.id
    }
    if (!authenticatedUserId) {
      setUsers([])
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('created_at', { ascending: true })
    if (error || !data) {
      setUsers([])
      return
    }

    const publicUsers = (data as ProfileRow[]).map(mapRow)
    const ownProfileResponse = await fetch('/api/account/profile', { cache: 'no-store' }).catch(() => null)
    let ownProfile: OwnPrivateProfile | null = null
    if (ownProfileResponse?.ok) {
      const payload = await ownProfileResponse.json().catch(() => null)
      if (payload?.profile?.id === authenticatedUserId) ownProfile = payload.profile as OwnPrivateProfile
    }

    const currentPublicProfile = publicUsers.find((profile) => profile.id === authenticatedUserId)
    let adminProfiles = new Map<string, AdminPrivateProfile>()
    if (currentPublicProfile?.role === 'owner') {
      const adminResponse = await fetch('/api/admin/staff', { cache: 'no-store' }).catch(() => null)
      if (adminResponse?.ok) {
        const payload = await adminResponse.json().catch(() => null)
        adminProfiles = new Map(
          ((payload?.users ?? []) as AdminPrivateProfile[]).map((profile) => [profile.id, profile] as const),
        )
      }
    }

    setUsers(
      publicUsers.map((profile) => {
        if (profile.id === authenticatedUserId && ownProfile) {
          return {
            ...profile,
            email: ownProfile.email ?? undefined,
            balance: Number(ownProfile.balance ?? 0),
            commission: Number(ownProfile.commission ?? 0),
            referralCode: ownProfile.referral_code ?? undefined,
            twoFactorEnabled: !!ownProfile.two_factor_enabled,
          }
        }

        const adminProfile = adminProfiles.get(profile.id)
        return adminProfile
          ? {
              ...profile,
              email: adminProfile.email ?? undefined,
              balance: Number(adminProfile.balance ?? 0),
            }
          : profile
      }),
    )
  }, [supabase])

  useEffect(() => {
    let activeSub = true

    async function boot() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!activeSub) return
      setUserId(user?.id ?? null)
      if (user) await refreshUsers(user.id)
      setReady(true)
    }
    boot()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      if (session?.user) {
        refreshUsers(session.user.id)
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
    async (data: {
      username: string
      displayName?: string
      email?: string
      password: string
      privacyPolicyAccepted: boolean
      termsOfUseAccepted: boolean
    }) => {
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
    const { error } = await supabase.auth.signOut()
    if (error) throw error
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
      // تحديث فوري متفائل لكل الحقول (بعضها يُكتب في قاعدة البيانات من الخادم)
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))

      if (patch.sellerPermissions !== undefined) {
        const response = await fetch('/api/admin/staff/permissions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id, permissions: patch.sellerPermissions }),
        })
        if (!response.ok) {
          await refreshUsers()
          throw new Error('تعذّر حفظ صلاحيات المتجر')
        }
      }

      const dbPatch: Record<string, unknown> = {}
      if (patch.active !== undefined) dbPatch.active = patch.active
      if (patch.role !== undefined) dbPatch.role = patch.role
      if (Object.keys(dbPatch).length > 0) await supabase.from('profiles').update(dbPatch).eq('id', id)
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
      refreshUsers,
      refresh: refreshUsers,
      login,
      register,
      logout,
      addStaff,
      updateUser,
      removeUser,
      rateUser,
    }),
    [user, users, ready, refreshUsers, login, register, logout, addStaff, updateUser, removeUser, rateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth يجب استخدامه داخل AuthProvider')
  return ctx
}
