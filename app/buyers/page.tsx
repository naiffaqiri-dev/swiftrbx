import type { Metadata } from 'next'
import { getBuyerLeaderboard } from '@/lib/buyers/leaderboard'
import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { BuyersLeaderboard } from '@/components/buyers-leaderboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'كبار المشترين | SwiftRBX',
  description: 'تعرّف على أكثر مشترِي الروبوكس نشاطاً في SwiftRBX.',
}

export default async function BuyersPage() {
  const leaderboard = await getBuyerLeaderboard()

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <BuyersLeaderboard {...leaderboard} />
      </main>
      <SupportButton />
    </div>
  )
}

