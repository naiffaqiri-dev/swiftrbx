import { NextResponse } from 'next/server'
import { requirePopupAnnouncementOwner } from '@/lib/popup-announcement-auth'

export async function GET() {
  const owner = await requirePopupAnnouncementOwner()
  if ('response' in owner) return owner.response

  const { data, error } = await owner.admin
    .from('profiles')
    .select('id,username,display_name,email,role')
    .eq('active', true)
    .order('username', { ascending: true })
    .limit(2000)

  if (error) {
    return NextResponse.json({ error: 'تعذّر تحميل قائمة المستخدمين' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json({ recipients: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}
