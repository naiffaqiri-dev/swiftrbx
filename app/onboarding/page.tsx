import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OnboardingForm } from '@/components/auth/onboarding-form'

export const dynamic = 'force-dynamic'

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  discord: 'Discord',
  email: 'البريد الإلكتروني',
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('onboarded')
    .eq('id', user.id)
    .maybeSingle()

  // من أكمل بياناته من قبل لا يرى النموذج مجدداً
  if (profile?.onboarded) redirect('/dashboard')

  const provider = (user.app_metadata?.provider as string) ?? 'email'

  return (
    <OnboardingForm
      defaultEmail={user.email ?? ''}
      provider={PROVIDER_LABELS[provider] ?? provider}
    />
  )
}
