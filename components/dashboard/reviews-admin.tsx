'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StarDisplay } from '@/components/reviews/star-rating'
import { Button } from '@/components/ui/button'
import { Loader2, Eye, EyeOff, Trash2, MessageSquareQuote } from 'lucide-react'

type Review = {
  id: string
  username: string
  rating: number
  comment: string
  approved: boolean
  created_at: string
}

export function ReviewsAdmin() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('site_reviews')
      .select('id, username, rating, comment, approved, created_at')
      .order('created_at', { ascending: false })
    setReviews((data ?? []) as Review[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function setApproved(id: string, approved: boolean) {
    const supabase = createClient()
    await supabase.from('site_reviews').update({ approved }).eq('id', id)
    load()
  }

  async function remove(id: string) {
    const supabase = createClient()
    await supabase.from('site_reviews').delete().eq('id', id)
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <MessageSquareQuote className="h-4 w-4 text-primary" /> تقييمات الموقع ({reviews.length})
      </h2>
      {reviews.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
          لا توجد تقييمات.
        </p>
      ) : (
        reviews.map((r) => (
          <div
            key={r.id}
            className={`flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
              r.approved ? 'border-border/60 bg-card/40' : 'border-destructive/30 bg-destructive/5'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{r.username || 'مستخدم'}</span>
                <StarDisplay value={r.rating} size={14} />
                {!r.approved && <span className="text-xs text-destructive">مخفي</span>}
              </div>
              <p className="text-sm text-muted-foreground">{r.comment}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setApproved(r.id, !r.approved)} className="gap-1">
                {r.approved ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {r.approved ? 'إخفاء' : 'إظهار'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
