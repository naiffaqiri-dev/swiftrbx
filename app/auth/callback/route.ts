import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { safeInternalPath } from '@/lib/auth-redirect'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeInternalPath(searchParams.get('next'), '/')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // مستخدمو Google/Discord الجدد يكملون نموذج إنشاء الحساب لمرة واحدة فقط
      if (user) {
        const admin = createAdminClient()
        const { data: profile } = await admin
          .from('profiles')
          .select('onboarded')
          .eq('id', user.id)
          .maybeSingle()
        if (!profile?.onboarded) {
          return NextResponse.redirect(`${origin}/onboarding?${new URLSearchParams({ next }).toString()}`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
