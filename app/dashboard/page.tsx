'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/i18n/locale-provider'
import { useAuth } from '@/components/auth/mock-auth'
import { OwnerPanel } from '@/components/dashboard/owner-panel'
import { SellerPanel } from '@/components/dashboard/seller-panel'
import { SupportPanel } from '@/components/dashboard/support-panel'
import { UserPanel } from '@/components/dashboard/user-panel'

export default function DashboardPage() {
  const { t } = useLocale()
  const { user, ready } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  if (!ready || !user) {
    return (
      <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center text-sm text-muted-foreground">
        {t('جارٍ التحميل…')}
      </div>
    )
  }

  switch (user.role) {
    case 'owner':
      return <OwnerPanel />
    case 'seller':
      return <SellerPanel />
    case 'support':
      return <SupportPanel />
    default:
      return <UserPanel />
  }
}
