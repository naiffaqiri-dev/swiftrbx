import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketplace_games')
    .select('id, name, emoji, thumbnail_url')
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'تعذّر تحميل المابات' }, { status: 500 })
  return NextResponse.json({ maps: data ?? [] })
}
