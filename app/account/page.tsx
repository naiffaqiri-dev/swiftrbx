import { SiteHeader } from '@/components/site-header'
import { SupportButton } from '@/components/support-button'
import { AccountView } from '@/components/account/account-view'

export default function AccountPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <AccountView />
      </main>
      <SupportButton />
    </div>
  )
}
