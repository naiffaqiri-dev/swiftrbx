'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/mock-auth'
import { useLocale } from '@/components/i18n/locale-provider'
import { Button } from '@/components/ui/button'
import {
  announcementImageUrl,
  announcementLinkTarget,
  createPopupSessionId,
  isPopupAnnouncement,
  markPopupAnnouncementSeen,
  popupCampaignBackCopy,
  popupCampaignButtonCopy,
  popupCampaignCloseCopy,
  popupCampaignForwardCopy,
  readPopupAnnouncementSeen,
  readPopupAnnouncementSessionId,
  type PopupAnnouncement,
  type PopupAnnouncementEventType,
} from '@/lib/popup-announcements'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'

type PublicCampaignResponse = { announcements: PopupAnnouncement[] }

async function fetchCampaigns(url: string): Promise<PublicCampaignResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load announcements')
  const body = await response.json()
  return { announcements: Array.isArray(body.announcements) ? body.announcements.filter(isPopupAnnouncement) : [] }
}

export function PopupAnnouncementLayer() {
  const { user, ready } = useAuth()
  const { lang } = useLocale()
  const pathname = usePathname()
  const ar = lang === 'ar'
  const tx = (arabic: string, english: string) => (ar ? arabic : english)
  const inDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname.startsWith('/admin')
  const staff = Boolean(user && user.role !== 'user')
  const { data } = useSWR(ready && !inDashboard && !staff ? '/api/popup-announcements' : null, fetchCampaigns, {
    revalidateOnFocus: true,
    refreshInterval: 60_000,
  })
  const [sessionId, setSessionId] = useState('')
  const [closedIds, setClosedIds] = useState<string[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState('')
  const [voted, setVoted] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const viewedId = useRef<string | null>(null)

  useEffect(() => {
    setSessionId(readPopupAnnouncementSessionId() || createPopupSessionId())
  }, [])

  const campaign = useMemo(() => {
    if (!sessionId) return undefined
    return data?.announcements.find((item) => !closedIds.includes(item.id) && !readPopupAnnouncementSeen(item.id))
  }, [closedIds, data, sessionId])
  const step = campaign?.steps[Math.min(stepIndex, (campaign?.steps.length ?? 1) - 1)]

  useEffect(() => {
    const dialog = dialogRef.current
    if (campaign && dialog && !dialog.open) dialog.showModal()
    if (!campaign && dialog?.open) dialog.close()
  }, [campaign?.id])

  useEffect(() => {
    if (!campaign || !sessionId || viewedId.current === campaign.id) return
    viewedId.current = campaign.id
    void recordEvent(campaign, sessionId, 'view', 0)
    setStepIndex(0)
    setSelectedChoice('')
    setVoted(false)
  }, [campaign?.id, sessionId])

  async function recordEvent(item: PopupAnnouncement, session: string, eventType: PopupAnnouncementEventType, index: number, choice?: string) {
    try {
      await fetch('/api/popup-announcements/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId: item.id, sessionId: session, eventType, stepIndex: index, ...(choice ? { choice } : {}) }),
        keepalive: true,
      })
    } catch {
      // Tracking is best-effort and should not interrupt the announcement.
    }
  }

  function closeCampaign(eventType: 'complete' | 'dismiss' = 'dismiss') {
    if (!campaign) return
    markPopupAnnouncementSeen(campaign.id)
    setClosedIds((ids) => ids.includes(campaign.id) ? ids : [...ids, campaign.id])
    void recordEvent(campaign, sessionId, eventType, stepIndex)
    if (dialogRef.current?.open) dialogRef.current.close()
  }

  function nextStep() {
    if (!campaign) return
    if (stepIndex < campaign.steps.length - 1) setStepIndex((index) => index + 1)
    else closeCampaign('complete')
  }

  function submitVote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!campaign || !step || !selectedChoice || voted) return
    setVoted(true)
    void recordEvent(campaign, sessionId, 'poll', stepIndex, selectedChoice)
  }

  if (!campaign || !step) return null

  const imageSrc = announcementImageUrl(step.imageUrl)
  const customAction = Boolean(step.buttonLabel.trim() && step.buttonUrl.trim())
  const Arrow = ar ? ArrowLeft : ArrowRight

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="popup-announcement-title"
      aria-describedby="popup-announcement-body"
      dir={ar ? 'rtl' : 'ltr'}
      onCancel={(event) => { event.preventDefault(); closeCampaign('dismiss') }}
      onClick={(event) => { if (event.target === event.currentTarget) closeCampaign('dismiss') }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-background/70 backdrop:backdrop-blur-sm"
    >
      <div className="relative max-h-[min(82svh,760px)] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-card/95 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            {campaign.subject && <p className="truncate text-xs font-semibold text-primary">{campaign.subject}</p>}
            <p className="truncate text-xs text-muted-foreground">{campaign.title}</p>
          </div>
          <button type="button" onClick={() => closeCampaign('dismiss')} aria-label={popupCampaignCloseCopy(lang)} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-5" /></button>
        </div>
        {imageSrc && <div className="relative aspect-video w-full bg-muted/40">
          <Image src={imageSrc} alt={step.title} fill unoptimized className="object-cover" sizes="(min-width: 640px) 576px, 100vw" />
        </div>}
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          {campaign.steps.length > 1 && <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-muted-foreground">{tx(`الخطوة ${stepIndex + 1} من ${campaign.steps.length}`, `Step ${stepIndex + 1} of ${campaign.steps.length}`)}</p>
            <div className="flex gap-1.5" aria-hidden="true">{campaign.steps.map((_, index) => <span key={index} className={`h-1.5 w-6 rounded-full ${index <= stepIndex ? 'bg-primary' : 'bg-muted'}`} />)}</div>
          </div>}
          <h2 id="popup-announcement-title" className="text-balance text-2xl font-bold leading-snug">{step.title}</h2>
          {step.body && <p id="popup-announcement-body" className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-muted-foreground">{step.body}</p>}

          {campaign.kind === 'survey' && !voted && <form onSubmit={submitVote} className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{tx('اختر إجابتك', 'Choose your answer')}</legend>
              {step.options.map((option, index) => <label key={`${option}-${index}`} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${selectedChoice === option ? 'border-primary/50 bg-primary/10' : 'border-border/60 hover:bg-muted/40'}`}>
                <input type="radio" name={`announcement-${campaign.id}`} value={option} checked={selectedChoice === option} onChange={() => setSelectedChoice(option)} className="size-4 accent-primary" />
                <span>{option}</span>
              </label>)}
            </fieldset>
            <Button type="submit" disabled={!selectedChoice}>{tx('إرسال التصويت', 'Submit vote')}</Button>
          </form>}

          {campaign.kind === 'survey' && voted && <div role="status" className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm leading-relaxed text-primary">{tx('شكرًا لمشاركتك، تم تسجيل تصويتك.', 'Thanks for sharing your opinion. Your vote has been recorded.')}</div>}

          {campaign.kind !== 'survey' && customAction && <a
            href={step.buttonUrl}
            target={announcementLinkTarget(step.buttonUrl)}
            rel={announcementLinkTarget(step.buttonUrl) === '_blank' ? 'noopener noreferrer' : undefined}
            onClick={() => { void recordEvent(campaign, sessionId, 'click', stepIndex); closeCampaign('complete') }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >{step.buttonLabel}<Arrow className="size-4" /></a>}

          {campaign.kind !== 'survey' && !customAction && <div className="flex items-center justify-between gap-3">
            {stepIndex > 0 ? <Button type="button" variant="outline" onClick={() => setStepIndex((index) => Math.max(0, index - 1))}><ArrowRight data-icon="inline-start" />{popupCampaignBackCopy(lang)}</Button> : <span />}
            <Button type="button" onClick={nextStep}>{campaign.kind === 'guide' && stepIndex < campaign.steps.length - 1 ? popupCampaignForwardCopy(lang) : popupCampaignButtonCopy(campaign.kind, lang)}{campaign.kind === 'guide' && stepIndex < campaign.steps.length - 1 && <Arrow data-icon="inline-end" />}</Button>
          </div>}

          {campaign.kind === 'survey' && voted && <div className="flex justify-end"><Button type="button" onClick={() => closeCampaign('complete')}>{popupCampaignButtonCopy(campaign.kind, lang)}</Button></div>}
        </div>
      </div>
    </dialog>
  )
}
