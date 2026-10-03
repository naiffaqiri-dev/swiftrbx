import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  }

  const identities = user.identities ?? []
  const providers = [...new Set(identities.map((identity) => identity.provider))]
  return NextResponse.json(
    { providers, identityCount: identities.length },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
