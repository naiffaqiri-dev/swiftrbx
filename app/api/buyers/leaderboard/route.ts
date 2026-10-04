import { NextResponse } from 'next/server'
import { getBuyerLeaderboard } from '@/lib/buyers/leaderboard'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getBuyerLeaderboard()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch {
    return NextResponse.json({ error: 'تعذّر تحميل ترتيب المشترين' }, { status: 500 })
  }
}
