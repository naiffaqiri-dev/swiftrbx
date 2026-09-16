'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { createClient } from '@/lib/supabase/client'
import { StarDisplay, StarInput } from './star-rating'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquareQuote, Send } from 'lucide-react'

type SiteReview = {
  id: string
  username: string
  rating: number
  comment: string
  created_at: string
}

export function SiteReviews({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<SiteReview[]>([])
  const [loading, setLoading] = useState(true)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('site_reviews')
      .select('id, username, rating, comment, created_at')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(compact ? 6 : 30)
    setReviews((data ?? []) as SiteReview[])
    setLoading(false)
  }, [compact])

  useEffect(() => {
    load()
  }, [load])

  async function submit() {
    if (!user || stars < 1 || !comment.trim() || saving) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('site_reviews').insert({
      user_id: user.id,
      username: user.username,
      rating: stars,
      comment: comment.trim().slice(0, 500),
    })
    setSaving(false)
    if (!error) {
      setStars(0)
      setComment('')
      setDone(true)
      setTimeout(() => setDone(false), 3000)
      load()
    }
  }

  const avg = reviews.length
    ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : 0

  return (
    <section className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-balance">
          <MessageSquareQuote className="h-6 w-6 text-primary" />
          آراء العملاء
        </h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <StarDisplay value={avg} size={18} />
            <span className="font-bold text-foreground">{avg}</span>
            <span>من {reviews.length} تقييم</span>
          </div>
        )}
      </div>

      {user && (
        <div className="mx-auto w-full max-w-lg space-y-3 rounded-2xl border border-border/60 bg-card/40 p-5">
          <p className="text-sm font-medium">شاركنا تجربتك مع الموقع</p>
          <div className="flex justify-center">
            <StarInput value={stars} onChange={setStars} />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="اكتب رأيك في خدمتنا…"
            className="w-full resize-none rounded-lg border border-border/60 bg-background p-3 text-sm outline-none focus:border-primary/60"
          />
          <Button onClick={submit} disabled={saving || stars < 1 || !comment.trim()} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {done ? 'شكراً لتقييمك!' : 'إرسال التقييم'}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
        </div>
      ) : reviews.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">لا توجد تقييمات بعد — كن أول من يقيّم!</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{r.username || 'مستخدم'}</span>
                <StarDisplay value={r.rating} size={14} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{r.comment}</p>
              <span className="mt-auto text-[11px] text-muted-foreground/70">
                {new Date(r.created_at).toLocaleDateString('ar')}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
