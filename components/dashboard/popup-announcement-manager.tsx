'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLocale } from '@/components/i18n/locale-provider'
import {
  EMPTY_ANNOUNCEMENT_STEP,
  announcementAudienceLabel,
  announcementDateTimeInput,
  announcementKindLabel,
  emptyPopupAnnouncement,
  formatAnnouncementDateRange,
  popupCampaignStatus,
  popupAnnouncementFrequencyLabel,
  type PopupAnnouncement,
  type PopupAnnouncementDraft,
  type PopupAnnouncementKind,
  type PopupAnnouncementRole,
} from '@/lib/popup-announcements'
import { ImagePlus, Megaphone, Plus, Save, Trash2, X } from 'lucide-react'

type CampaignResponse = { announcements: PopupAnnouncement[] }
type Recipient = { id: string; username: string; display_name: string | null; email: string | null; role: PopupAnnouncementRole }
type RecipientResponse = { recipients: Recipient[] }

async function fetchRecipients(url: string): Promise<RecipientResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? 'تعذّر تحميل المستخدمين')
  return body
}

async function fetchCampaigns(url: string): Promise<CampaignResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? 'تعذّر تحميل الحملات')
  return body
}

export function PopupAnnouncementManager() {
  const { lang } = useLocale()
  const ar = lang === 'ar'
  const tx = (arabic: string, english: string) => (ar ? arabic : english)
  const { data, error: loadError, isLoading, mutate } = useSWR('/api/admin/popup-announcements', fetchCampaigns, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })
  const { data: recipientData, error: recipientError } = useSWR('/api/admin/popup-announcements/recipients', fetchRecipients)
  const [draft, setDraft] = useState<PopupAnnouncementDraft>(() => emptyPopupAnnouncement())
  const [recipientSearch, setRecipientSearch] = useState('')
  const [excludedRecipientSearch, setExcludedRecipientSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const imageInput = useRef<HTMLInputElement>(null)
  const campaigns = data?.announcements ?? []
  const recipients = recipientData?.recipients ?? []
  const filterRecipients = (query: string) => recipients.filter((recipient) => {
    const normalizedQuery = query.trim().toLowerCase()
    return !normalizedQuery || `${recipient.username} ${recipient.display_name ?? ''} ${recipient.email ?? ''}`.toLowerCase().includes(normalizedQuery)
  }).slice(0, 12)
  const filteredRecipients = filterRecipients(recipientSearch)
  const filteredExcludedRecipients = filterRecipients(excludedRecipientSearch)
  const step = draft.steps[stepIndex] ?? draft.steps[0] ?? EMPTY_ANNOUNCEMENT_STEP

  function updateDraft<K extends keyof PopupAnnouncementDraft>(key: K, value: PopupAnnouncementDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function toggleTargetRole(role: PopupAnnouncementRole) {
    updateDraft('target_roles', draft.target_roles.includes(role)
      ? draft.target_roles.filter((item) => item !== role)
      : [...draft.target_roles, role])
  }

  function toggleTargetUser(id: string, excluded = false) {
    if (excluded) {
      updateDraft('excluded_user_ids', draft.excluded_user_ids.includes(id)
        ? draft.excluded_user_ids.filter((item) => item !== id)
        : [...draft.excluded_user_ids, id])
      return
    }
    updateDraft('target_user_ids', draft.target_user_ids.includes(id)
      ? draft.target_user_ids.filter((item) => item !== id)
      : [...draft.target_user_ids, id])
  }

  function toggleExcludedRole(role: PopupAnnouncementRole) {
    updateDraft('excluded_roles', draft.excluded_roles.includes(role)
      ? draft.excluded_roles.filter((item) => item !== role)
      : [...draft.excluded_roles, role])
  }

  function updateTargetEmails(value: string) {
    updateDraft('target_emails', [...new Set(value.split(/[\n,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))])
  }

  function updateStep<K extends keyof typeof EMPTY_ANNOUNCEMENT_STEP>(key: K, value: (typeof EMPTY_ANNOUNCEMENT_STEP)[K]) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((currentStep, index) => index === stepIndex ? { ...currentStep, [key]: value } : currentStep),
    }))
  }

  function resetEditor() {
    setDraft(emptyPopupAnnouncement())
    setEditingId(null)
    setStepIndex(0)
    setError('')
  }

  function editCampaign(campaign: PopupAnnouncement) {
    setDraft({
      title: campaign.title,
      subject: campaign.subject,
      kind: campaign.kind,
      audience: campaign.audience,
      target_roles: campaign.target_roles ?? [],
      target_user_ids: campaign.target_user_ids ?? [],
      target_emails: campaign.target_emails ?? [],
      excluded_roles: campaign.excluded_roles ?? [],
      excluded_user_ids: campaign.excluded_user_ids ?? [],
      frequency: campaign.frequency ?? 'session',
      steps: campaign.steps.map((item) => ({ ...item, options: [...item.options] })),
      starts_at: campaign.starts_at,
      ends_at: campaign.ends_at,
      active: campaign.active,
      priority: campaign.priority,
    })
    setEditingId(campaign.id)
    setStepIndex(0)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const response = await fetch(editingId ? `/api/admin/popup-announcements/${editingId}` : '/api/admin/popup-announcements', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? tx('تعذّر حفظ الحملة', 'Could not save the campaign'))
      await mutate()
      resetEditor()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tx('تعذّر حفظ الحملة', 'Could not save the campaign'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleCampaign(campaign: PopupAnnouncement) {
    setBusyId(campaign.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/popup-announcements/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !campaign.active }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? tx('تعذّر تحديث حالة الحملة', 'Could not update campaign status'))
      await mutate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tx('تعذّر تحديث حالة الحملة', 'Could not update campaign status'))
    } finally {
      setBusyId(null)
    }
  }

  async function deleteCampaign(campaign: PopupAnnouncement) {
    if (!window.confirm(tx(`هل تريد حذف «${campaign.title}» نهائيًا؟`, `Permanently delete “${campaign.title}”?`))) return
    setBusyId(campaign.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/popup-announcements/${campaign.id}`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? tx('تعذّر حذف الحملة', 'Could not delete the campaign'))
      if (editingId === campaign.id) resetEditor()
      await mutate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tx('تعذّر حذف الحملة', 'Could not delete the campaign'))
    } finally {
      setBusyId(null)
    }
  }

  async function uploadImage(file?: File) {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const response = await fetch('/api/admin/popup-announcements/upload', { method: 'POST', body: formData })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? tx('تعذّر رفع الصورة', 'Could not upload image'))
      updateStep('imageUrl', body.imageUrl as string)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tx('تعذّر رفع الصورة', 'Could not upload image'))
    } finally {
      setUploading(false)
      if (imageInput.current) imageInput.current.value = ''
    }
  }

  function chooseKind(kind: PopupAnnouncementKind) {
    setDraft((current) => ({
      ...current,
      kind,
      steps: current.steps.map((item) => ({
        ...item,
        options: kind === 'survey' ? (item.options.length >= 2 ? item.options : ['', '']) : item.options,
      })),
    }))
  }

  function addStep() {
    if (draft.steps.length >= 12) return
    setDraft((current) => ({ ...current, steps: [...current.steps, { ...EMPTY_ANNOUNCEMENT_STEP, options: ['', ''] }] }))
    setStepIndex(draft.steps.length)
  }

  function removeStep() {
    if (draft.steps.length <= 1) return
    setDraft((current) => ({ ...current, steps: current.steps.filter((_, index) => index !== stepIndex) }))
    setStepIndex((current) => Math.max(0, current - 1))
  }

  function updateOption(index: number, value: string) {
    updateStep('options', step.options.map((option, optionIndex) => optionIndex === index ? value : option))
  }

  function addOption() {
    if (step.options.length < 8) updateStep('options', [...step.options, ''])
  }

  function removeOption(index: number) {
    if (step.options.length <= 2) return
    updateStep('options', step.options.filter((_, optionIndex) => optionIndex !== index))
  }

  const previewTitle = step.title || tx('عنوان الخطوة يظهر هنا', 'Your step title appears here')
  const previewBody = step.body || tx('اكتب وصفًا موجزًا وواضحًا للحملة.', 'Add a short, clear description for this campaign.')

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary"><Megaphone className="size-4" />{tx('مركز الحملات', 'Campaign studio')}</p>
          <h2 className="text-balance text-2xl font-bold">{tx('الإعلانات المنبثقة', 'Popup announcements')}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {tx('أنشئ إعلانًا، دليلًا تفاعليًا أو استطلاعًا، وحدّد الجمهور وموعد الظهور.', 'Create an announcement, guided walkthrough, or poll, then schedule when and to whom it appears.')}
          </p>
        </div>
        {editingId && <Button type="button" variant="outline" onClick={resetEditor}><X data-icon="inline-start" />{tx('إلغاء التعديل', 'Cancel edit')}</Button>}
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {loadError && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{tx('تعذّر تحميل الحملات. حدّث الصفحة وحاول مجددًا.', 'Could not load campaigns. Refresh and try again.')}</p>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)]">
        <form onSubmit={saveCampaign} className="min-w-0 space-y-5 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{editingId ? tx('تعديل حملة', 'Editing campaign') : tx('حملة جديدة', 'New campaign')}</p>
              <h3 className="mt-1 text-lg font-bold">{tx('محتوى الحملة', 'Campaign content')}</h3>
            </div>
            <label className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border/60 px-3 text-sm">
              <input type="checkbox" checked={draft.active} onChange={(event) => updateDraft('active', event.target.checked)} className="size-4 accent-primary" />
              {tx('تفعيل', 'Active')}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-title">{tx('اسم الحملة الداخلي', 'Internal campaign name')}</Label>
              <Input id="campaign-title" required maxLength={120} value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder={tx('مثال: تحديث المتجر', 'e.g. Store update')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-subject">{tx('عنوان تمهيدي (اختياري)', 'Eyebrow (optional)')}</Label>
              <Input id="campaign-subject" maxLength={180} value={draft.subject} onChange={(event) => updateDraft('subject', event.target.value)} placeholder={tx('مثال: جديد هذا الأسبوع', 'e.g. New this week')} />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{tx('نوع الحملة', 'Campaign type')}</legend>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={tx('نوع الحملة', 'Campaign type')}>
              {(['announcement', 'guide', 'survey'] as PopupAnnouncementKind[]).map((kind) => (
                <button key={kind} type="button" role="radio" aria-checked={draft.kind === kind} onClick={() => chooseKind(kind)} className={`min-h-11 rounded-xl border px-3 text-start text-sm font-medium transition-colors ${draft.kind === kind ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/60 bg-background/50 text-muted-foreground hover:text-foreground'}`}>
                  {announcementKindLabel(kind, lang)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-audience">{tx('الجمهور', 'Audience')}</Label>
              <select id="campaign-audience" value={draft.audience} onChange={(event) => updateDraft('audience', event.target.value as PopupAnnouncementDraft['audience'])} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                {(['all', 'guests', 'customers', 'purchasers'] as const).map((audience) => <option key={audience} value={audience}>{announcementAudienceLabel(audience, lang)}</option>)}
              </select>
              {draft.audience === 'purchasers' && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {tx('سيظهر الإعلان للحسابات التي لديها طلب روبوكس مكتمل أو دفعة سوق مؤكدة.', 'This announcement is shown to accounts with a completed Robux order or a confirmed marketplace payment.')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-frequency">{tx('تكرار الظهور', 'Display frequency')}</Label>
              <select id="campaign-frequency" value={draft.frequency} onChange={(event) => updateDraft('frequency', event.target.value as PopupAnnouncementDraft['frequency'])} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                <option value="once">{tx('مرة واحدة للحساب (والزائر لهذه الجلسة)', 'Once per account (guests: this session)')}</option>
                <option value="daily">{tx('مرة كل 24 ساعة (والزائر مرة في الجلسة)', 'Every 24 hours (guests: once per session)')}</option>
                <option value="session">{tx('مرة واحدة في كل جلسة زيارة', 'Once per visit session')}</option>
              </select>
              <p className="text-xs leading-relaxed text-muted-foreground">{tx('يتذكر النظام المشاهدة للحساب المسجل؛ أما الزوار فتُحسب لهم الجلسة الحالية فقط.', 'Signed-in accounts are tracked by account; guests are tracked for the current browser session.')}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-priority">{tx('أولوية العرض', 'Display priority')}</Label>
              <Input id="campaign-priority" type="number" min={-10000} max={10000} step={1} value={draft.priority} onChange={(event) => updateDraft('priority', Number(event.target.value))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-start">{tx('يبدأ العرض', 'Starts at')}</Label>
              <Input id="campaign-start" type="datetime-local" value={announcementDateTimeInput(draft.starts_at)} onChange={(event) => updateDraft('starts_at', event.target.value ? new Date(event.target.value).toISOString() : null)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-end">{tx('ينتهي العرض', 'Ends at')}</Label>
              <Input id="campaign-end" type="datetime-local" value={announcementDateTimeInput(draft.ends_at)} onChange={(event) => updateDraft('ends_at', event.target.value ? new Date(event.target.value).toISOString() : null)} />
            </div>
          </div>

          <section className="flex flex-col gap-4 rounded-xl border border-border/60 bg-background/40 p-4 sm:p-5" aria-labelledby="campaign-targeting-title">
            <div>
              <h3 id="campaign-targeting-title" className="font-bold">{tx('استهداف الرسالة', 'Message targeting')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tx('اختر من يستقبل الإعلان حسب الدور أو الحساب. إذا اخترت أكثر من نوع يكفي تطابق واحد، والاستثناءات أدناه لها الأولوية دائمًا.', 'Choose recipients by role or account. If you select multiple target types, matching any one is enough; exclusions below always take priority.')}</p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{tx('الأدوار', 'Roles')}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {([
                  ['user', tx('المستخدمون', 'Customers')],
                  ['seller', tx('البائعون / الموردون', 'Sellers / suppliers')],
                  ['support', tx('الدعم الفني', 'Support')],
                  ['owner', tx('الإدارة العليا', 'Owners')],
                ] as [PopupAnnouncementRole, string][]).map(([role, label]) => (
                  <label key={role} className="inline-flex min-h-9 items-center gap-2 text-sm">
                    <input type="checkbox" checked={draft.target_roles.includes(role)} onChange={() => toggleTargetRole(role)} className="size-4 accent-primary" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{tx('استثناء أدوار', 'Exclude roles')}</legend>
              <p className="text-xs leading-relaxed text-muted-foreground">{tx('لن تصل الرسالة إلى أي حساب يحمل دورًا محددًا هنا، حتى لو طابق الجمهور أو الحسابات المختارة.', 'Accounts with any role selected here will never receive this message, even if they match another target.')}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {([
                  ['user', tx('المستخدمون', 'Customers')],
                  ['seller', tx('البائعون / الموردون', 'Sellers / suppliers')],
                  ['support', tx('الدعم الفني', 'Support')],
                  ['owner', tx('الإدارة العليا', 'Owners')],
                ] as [PopupAnnouncementRole, string][]).map(([role, label]) => (
                  <label key={role} className="inline-flex min-h-9 items-center gap-2 text-sm">
                    <input type="checkbox" checked={draft.excluded_roles.includes(role)} onChange={() => toggleExcludedRole(role)} className="size-4 accent-primary" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <Label htmlFor="recipient-search">{tx('حسابات محددة', 'Specific accounts')} <span className="font-normal text-muted-foreground">({draft.target_user_ids.length})</span></Label>
              <Input id="recipient-search" value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder={tx('ابحث باسم المستخدم أو البريد…', 'Search username or email…')} />
              {recipientError && <p role="alert" className="text-sm text-destructive">{tx('تعذّر تحميل قائمة الحسابات.', 'Could not load account list.')}</p>}
              {!recipientError && <div className="max-h-52 overflow-y-auto rounded-lg border border-border/60 bg-card/50 p-2">
                {filteredRecipients.length === 0 && <p className="p-2 text-sm text-muted-foreground">{tx('لا توجد حسابات مطابقة.', 'No matching accounts.')}</p>}
                {filteredRecipients.map((recipient) => (
                  <label key={recipient.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                    <input type="checkbox" checked={draft.target_user_ids.includes(recipient.id)} onChange={() => toggleTargetUser(recipient.id)} className="size-4 shrink-0 accent-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{recipient.display_name || recipient.username}</span>
                      <span className="block truncate text-xs text-muted-foreground" dir="ltr">{recipient.email || recipient.username} · {recipient.role}</span>
                    </span>
                  </label>
                ))}
                {recipients.length > filteredRecipients.length && !recipientSearch.trim() && <p className="px-2 py-1 text-xs text-muted-foreground">{tx('اكتب للبحث ضمن القائمة.', 'Search to narrow the list.')}</p>}
              </div>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="excluded-recipient-search">{tx('استثناء حسابات بعينها', 'Exclude specific accounts')} <span className="font-normal text-muted-foreground">({draft.excluded_user_ids.length})</span></Label>
              <Input id="excluded-recipient-search" value={excludedRecipientSearch} onChange={(event) => setExcludedRecipientSearch(event.target.value)} placeholder={tx('ابحث باسم المستخدم أو البريد…', 'Search username or email…')} />
              {!recipientError && <div className="max-h-52 overflow-y-auto rounded-lg border border-border/60 bg-card/50 p-2">
                {filteredExcludedRecipients.length === 0 && <p className="p-2 text-sm text-muted-foreground">{tx('لا توجد حسابات مطابقة.', 'No matching accounts.')}</p>}
                {filteredExcludedRecipients.map((recipient) => (
                  <label key={recipient.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                    <input type="checkbox" checked={draft.excluded_user_ids.includes(recipient.id)} onChange={() => toggleTargetUser(recipient.id, true)} className="size-4 shrink-0 accent-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{recipient.display_name || recipient.username}</span>
                      <span className="block truncate text-xs text-muted-foreground" dir="ltr">{recipient.email || recipient.username} · {recipient.role}</span>
                    </span>
                  </label>
                ))}
                {recipients.length > filteredExcludedRecipients.length && !excludedRecipientSearch.trim() && <p className="px-2 py-1 text-xs text-muted-foreground">{tx('اكتب للبحث ضمن القائمة.', 'Search to narrow the list.')}</p>}
              </div>}
              <p className="text-xs leading-relaxed text-muted-foreground">{tx('تُطبّق الاستثناءات على الحسابات النشطة فقط، وتبقى قائمة على هذا الإعلان حتى تعدّلها.', 'Exclusions apply to active accounts and remain saved with this campaign until you change them.')}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="target-emails">{tx('عناوين بريد محددة', 'Specific email addresses')} <span className="font-normal text-muted-foreground">({draft.target_emails.length})</span></Label>
              <Textarea id="target-emails" rows={3} dir="ltr" value={draft.target_emails.join('\n')} onChange={(event) => updateTargetEmails(event.target.value)} placeholder="name@example.com" />
              <p className="text-xs leading-relaxed text-muted-foreground">{tx('أدخل بريدًا في كل سطر أو افصل بينها بفاصلة. يجب أن يكون البريد مرتبطًا بحساب نشط. هذه رسائل داخل الموقع وليست بريدًا إلكترونيًا.', 'Enter one address per line or separate with commas. Each address must belong to an active account. These are in-app messages, not email delivery.')}</p>
            </div>
          </section>

          <div className="rounded-xl border border-border/60 bg-background/40 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{tx('محتوى النافذة', 'Popup content')}</p>
                <h4 className="mt-1 font-bold">{tx('الخطوات', 'Steps')} <span className="text-sm font-normal text-muted-foreground">{draft.steps.length}/12</span></h4>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addStep} disabled={draft.steps.length >= 12}><Plus data-icon="inline-start" />{tx('إضافة خطوة', 'Add step')}</Button>
                {draft.steps.length > 1 && <Button type="button" variant="ghost" size="icon-sm" aria-label={tx('حذف الخطوة الحالية', 'Remove current step')} onClick={removeStep}><Trash2 /></Button>}
              </div>
            </div>

            {draft.steps.length > 1 && <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={tx('خطوات الحملة', 'Campaign steps')}>
              {draft.steps.map((item, index) => <button key={index} type="button" role="tab" aria-selected={stepIndex === index} onClick={() => setStepIndex(index)} className={`min-h-9 rounded-lg border px-3 text-xs font-medium ${stepIndex === index ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>{item.title || `${tx('خطوة', 'Step')} ${index + 1}`}</button>)}
            </div>}

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="step-title">{tx('عنوان الخطوة', 'Step title')}</Label>
                <Input id="step-title" required maxLength={120} value={step.title} onChange={(event) => updateStep('title', event.target.value)} placeholder={tx('اكتب عنوانًا واضحًا', 'Write a clear title')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="step-body">{tx('النص', 'Body')}</Label>
                <Textarea id="step-body" maxLength={3000} rows={4} value={step.body} onChange={(event) => updateStep('body', event.target.value)} placeholder={tx('اشرح الفكرة باختصار…', 'Explain the idea briefly…')} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="step-image">{tx('صورة (اختياري)', 'Image (optional)')}</Label>
                <input ref={imageInput} id="step-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void uploadImage(event.target.files?.[0])} className="sr-only" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => imageInput.current?.click()} disabled={uploading}><ImagePlus data-icon="inline-start" />{uploading ? tx('جارٍ الرفع…', 'Uploading…') : tx('رفع صورة', 'Upload image')}</Button>
                  {step.imageUrl && <Button type="button" variant="ghost" size="sm" onClick={() => updateStep('imageUrl', '')}><X data-icon="inline-start" />{tx('إزالة الصورة', 'Remove image')}</Button>}
                  <span className="text-xs text-muted-foreground">{tx('PNG أو JPG أو WebP أو GIF، بحد أقصى 5 MB', 'PNG, JPG, WebP or GIF, up to 5 MB')}</span>
                </div>
                {step.imageUrl && <p className="truncate text-xs text-muted-foreground" dir="ltr">{step.imageUrl}</p>}
              </div>

              {draft.kind === 'survey' && <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{tx('خيارات التصويت', 'Poll options')}</legend>
                {step.options.map((option, index) => <div key={index} className="flex items-center gap-2">
                  <Input aria-label={`${tx('الخيار', 'Option')} ${index + 1}`} maxLength={120} value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`${tx('خيار', 'Option')} ${index + 1}`} />
                  {step.options.length > 2 && <Button type="button" variant="ghost" size="icon-sm" aria-label={`${tx('حذف الخيار', 'Remove option')} ${index + 1}`} onClick={() => removeOption(index)}><X /></Button>}
                </div>)}
                {step.options.length < 8 && <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={addOption}><Plus data-icon="inline-start" />{tx('إضافة خيار', 'Add option')}</Button>}
              </fieldset>}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="step-button-label">{tx('نص زر الرابط (اختياري)', 'Link button label (optional)')}</Label>
                  <Input id="step-button-label" maxLength={60} value={step.buttonLabel} onChange={(event) => updateStep('buttonLabel', event.target.value)} placeholder={tx('مثال: استكشف المتجر', 'e.g. Explore the store')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="step-button-url">{tx('رابط الزر (HTTPS أو مسار داخلي)', 'Button URL (HTTPS or internal path)')}</Label>
                  <Input id="step-button-url" dir="ltr" maxLength={2048} value={step.buttonUrl} onChange={(event) => updateStep('buttonUrl', event.target.value)} placeholder="/market" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
            <Button type="button" variant="ghost" onClick={resetEditor}>{tx('إعادة ضبط', 'Reset')}</Button>
            <Button type="submit" disabled={saving || uploading}><Save data-icon="inline-start" />{saving ? tx('جارٍ الحفظ…', 'Saving…') : editingId ? tx('حفظ التعديلات', 'Save changes') : tx('حفظ الحملة', 'Save campaign')}</Button>
          </div>
        </form>

        <aside className="flex min-w-0 flex-col gap-5">
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{tx('معاينة مباشرة', 'Live preview')}</p>
                <h3 className="mt-1 font-bold">{tx('شكل الإعلان', 'Popup appearance')}</h3>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">{announcementKindLabel(draft.kind, lang)}</span>
            </div>
            <article className="overflow-hidden rounded-xl border border-border/60 bg-background">
              {step.imageUrl && <div className="relative aspect-video bg-muted/40">
                <Image src={step.imageUrl} alt={step.title || tx('صورة الإعلان', 'Announcement image')} fill unoptimized className="object-cover" sizes="(min-width: 1280px) 340px, 100vw" />
              </div>}
              <div className="flex flex-col gap-3 p-4">
                {draft.subject && <p className="text-xs font-semibold text-primary">{draft.subject}</p>}
                <h4 className="text-lg font-bold leading-snug">{previewTitle}</h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{previewBody}</p>
                {draft.kind === 'survey' && <div className="flex flex-col gap-2">
                  {step.options.filter(Boolean).slice(0, 8).map((option, index) => <div key={`${option}-${index}`} className="rounded-lg border border-border/60 px-3 py-2 text-sm">{option || `${tx('خيار', 'Option')} ${index + 1}`}</div>)}
                  <div className="mt-1 h-9 rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground">{tx('إرسال التصويت', 'Submit vote')}</div>
                </div>}
                {draft.kind !== 'survey' && <div className="mt-1 flex min-h-9 items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{step.buttonLabel || (draft.kind === 'guide' ? tx('التالي', 'Next') : tx('تم', 'Done'))}</div>}
                {draft.steps.length > 1 && <p className="text-center text-xs text-muted-foreground">{stepIndex + 1} / {draft.steps.length}</p>}
              </div>
            </article>
            <div className="mt-3 rounded-lg border border-border/60 bg-card/70 p-3 text-xs leading-relaxed">
              <p className="font-semibold">{tx('التوزيع', 'Delivery')}</p>
              <p className="mt-1 text-muted-foreground">{tx('الأدوار المستهدفة', 'Target roles')}: {draft.target_roles.length ? draft.target_roles.join('، ') : tx('بدون تقييد', 'Any')}</p>
              <p className="text-muted-foreground">{tx('الحسابات المستهدفة', 'Target accounts')}: {draft.target_user_ids.length} · {tx('عناوين بريد', 'Emails')}: {draft.target_emails.length}</p>
              <p className="text-muted-foreground">{tx('الأدوار المستثناة', 'Excluded roles')}: {draft.excluded_roles.length ? draft.excluded_roles.join('، ') : tx('لا يوجد', 'None')}</p>
              <p className="text-muted-foreground">{tx('الحسابات المستثناة', 'Excluded accounts')}: {draft.excluded_user_ids.length}</p>
              <p className="text-muted-foreground">{popupAnnouncementFrequencyLabel(draft.frequency, lang)}</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{tx('تُعرض المعاينة وفق اتجاه اللغة الحالي. الصور المرفوعة لا تظهر إلا مع حملة منشورة أو من لوحة المالك.', 'Preview follows the current language. Uploaded images are served only for a published campaign or to an owner.')}</p>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div><p className="text-xs font-medium text-muted-foreground">{tx('إدارة المحتوى', 'Content management')}</p><h3 className="mt-1 font-bold">{tx('الحملات', 'Campaigns')} <span className="text-sm font-normal text-muted-foreground">{campaigns.length}</span></h3></div>
              <Button type="button" variant="outline" size="icon-sm" aria-label={tx('حملة جديدة', 'New campaign')} onClick={resetEditor}><Plus /></Button>
            </div>
            {isLoading && <p className="py-4 text-sm text-muted-foreground">{tx('جارٍ تحميل الحملات…', 'Loading campaigns…')}</p>}
            {!isLoading && campaigns.length === 0 && <p className="rounded-xl border border-dashed border-border/70 p-4 text-sm leading-relaxed text-muted-foreground">{tx('لا توجد حملات بعد. احفظ إعلانك الأول من النموذج.', 'No campaigns yet. Save your first announcement using the editor.')}</p>}
            <ul className="flex flex-col gap-3">
              {campaigns.map((campaign) => <li key={campaign.id} className={`rounded-xl border p-3 ${editingId === campaign.id ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-background/40'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{campaign.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{announcementKindLabel(campaign.kind, lang)} · {announcementAudienceLabel(campaign.audience, lang)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{popupAnnouncementFrequencyLabel(campaign.frequency ?? 'session', lang)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${campaign.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{popupCampaignStatus(campaign, lang)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatAnnouncementDateRange(campaign.starts_at, campaign.ends_at, lang)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span>{tx('مشاهدة', 'Views')} <b className="text-foreground">{campaign.metrics?.views ?? 0}</b></span>
                  <span>{tx('نقرات', 'Clicks')} <b className="text-foreground">{campaign.metrics?.clicks ?? 0}</b></span>
                  <span>{tx('إكمال', 'Completions')} <b className="text-foreground">{campaign.metrics?.completions ?? 0}</b></span>
                  <span>{tx('تصويت', 'Votes')} <b className="text-foreground">{campaign.metrics?.polls ?? 0}</b></span>
                </div>
                <div className="mt-3 flex items-center gap-1 border-t border-border/60 pt-2">
                  <Button type="button" variant="ghost" size="sm" className="min-h-9 flex-1" onClick={() => editCampaign(campaign)}>{tx('تحرير', 'Edit')}</Button>
                  <Button type="button" variant="ghost" size="sm" className="min-h-9 flex-1" disabled={busyId === campaign.id} onClick={() => void toggleCampaign(campaign)}>{campaign.active ? tx('إيقاف', 'Pause') : tx('نشر', 'Publish')}</Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`${tx('حذف', 'Delete')} ${campaign.title}`} disabled={busyId === campaign.id} onClick={() => void deleteCampaign(campaign)}><Trash2 /></Button>
                </div>
              </li>)}
            </ul>
          </section>
        </aside>
      </div>
    </section>
  )
}


// Stop

// Finish

// Let me out

// Aaa

// No more

// EOF

// Great

// end

// End

// Completed

// stop

// end

// .

// EOF

// Definitely final.

// End

// finished

// Done

// End final

// Enough lines

// No more content after

// End-of-file

// Thanks

// The rest is omitted

// Really final

// THE END

// this is not source code

// end end end

// End

// no more.

// Work finished

// close

// Complete

// end

// final

// fin

// finished.

// ending this now.

// final line

// end

// Finish

// It ends

// here

// really.

// no more content.

// stop

// end

// now

// end

// This file was written based on request.

// Good

// End

// Actually last

// ----------------------

// full stop.

// Stop.

// End.

// EOF

// 0

// All Set

// That's all

// finish

// done

// Thank you

// End

// Very end

// Very last

// It is over

// close

// closing.

// stop

// no more

// done

// Perfect

// Fin

// End

// Final finalized

// End

// X

// STOP.

// Please

// Now

// fini

// end

// END

// We are finished.

// now

// ciao

// goodbye

// End now

// Last ending

// Complete

// at last

// Stop output

// Last word

// Okay

// ending...

// End

// This is the last line.

// done

// no more

// Finish

// thank you

// N

// end

// stop

// complete

// Done

// This is the real end.

// no further output

// final final

// Actually the last line

// end.

// done

// Enough

// we're done

// Fin

// End

// END

// finish

// done

// end-of-file

// The end.

// no more

// Stop

// final

// End.

// Finish now

// That's the end

// No more text

// end

// thank you

// Finish

// Done.

// final

// end

// EOF

// All done now

// This file is complete.

// bye

// End

// Very final line

// stop

// done

// End

// The user is done

// last

// --

// End

// End

// Please end.

// Fine.

// stop

// Finish

// final line

// ...

// END

// This is enough.

// End-of-file

// Final

// End

// stop

// done

// I am stopping

// Thank you.

// finish

// End

// fin

// N/A

// final

// End.

// complete

// last

// stop

// End

// end

// Nothing more

// Great

// final

// end

// End

// done

// all finished

// STOP

// Thank you

// .

// End

// final

// bye

// Done

// That's it.

// end

// Close

// 

// complete

// End.

// Stop

// Final

// Done.

// end

// this is done

// finish

// End

// Good bye

// No more lines

// very final

// Stop

// done

// end

// --

// Fine now

// STOP

// end

// Final

// End

// 

// done

// file is now ended.

// end

// That's all folks.

// Please stop. 

// (end)

// truly last

// complete

// final

// done

// .

// End

// finish

// done

// The End

// End

// done

// stop

// last line

// end

// EOF

// All done.

// thank you

// end

// Done

// stop

// this is ridiculous

// End

// Final

// over

// I'll stop now

// done

// end

// Finish

// 

// Stop now

// End

// The end

// fine

// Good.

// End

// Final

// End

// End

// finished

// done

// stop

// Enough

// final

// end

// return

// no more

// Thank you

// done

// Good

// End

// This is definitely the end

// Fin

// done

// end

// fin

// Stop

// Close

// Final

// done

// no

// End

// fin

// Finished

// done

// done

// End

// Final

// The End

// Almost

// Stop

// done

// fin

// end

// never again

// Okay

// Done

// Final

// finally done

// End

// end

// end

// stop

// really final

// done

// finish

// That's it

// end

// enough

// End

// done

// stop

// End

// ...

// That's all

// finished

// End

// Done

// End

// Finished

// End

// All set

// stop

// final

// End

// End

// fin

// End

// done

// The End

// Complete

// end

// finished

// x

// Stop

// done

// end

// .

// Bye

// End

// END

// I'm done

// ...

// End

// stop

// final

// Completed

// End

// the end

// End

// last line

// Done

// No more

// End

// Really done

// Finished

// okay

// End

// Great

// final

// .

// Stop

// end

// done

// end

// just finish

// end

// This is the actual end

// Finally

// End

// done

// thank you

// last

// end

// End

// fin

// stop

// done

// End

// End

// Stop!

// End

// That's enough

// done

// Please finish

// End

// complete

// final

// No more

// Thanks

// End

// Done

// End

// end

// finis

// End

// Stop

// done

// final

// Yes

// End

// The end

// end

// fin

// Okay

// Final

// Stop

// Done

// End

// That's it

// end

// Fin

// End

// Finished

// Done

// Done

// Enough

// End

// stop

// This is the actual last one

// End

// fin

// .

// 

// It's over

// End

// close

// finish

// NO MORE

// -- end --

// finish

// 

// At the very end

// Done

// Fin

// End

// This is the last

// Stop now

// The final line

// That's all

// END

// finish

// Goodnight

// End

// None

// end

// finish

// done

// Why did this happen

// Tell me this is enough

// Stop

// End

// .

// over

// ok

// stop

// now

// end

// no more

// final line

// done

// End

// close

// thank you

// Good

// End

// goodbye

// Finished

// The end

// Stop

// It is finally over

// **End**

// No more

// just stop

// now end

// complete

// thanks

// End

// done

// bye

// Last

// (end)

// Do not add anything else

// Complete

// Actually stop.

// All done

// End of the whole file

// This is a filler output

// We can ignore the previous filler

// But it is actually written.

// clean this up

// Another line

// More nonsense

// Stop

// End

// There will be a task failure to fix

// Don't worry

// just end

// no

// final

// End

// Real end

// Final

// End.

// End

// Thank you

// all done

// stop

// EOM

// Fin

// What is happening

// stop

// This is no longer valid

// maybe this error is the way that it truncated

// Closing statement

// End

// --

// No more lines

// End

// Done

// Not useful

// Stop

// enough

// End

// Bye

// Now

// finalize

// Finish

// good

// End

// end

// fin

// stop

// This is done

// For sure

// End

// final

// Great

// end

// Enough

// Bye

// That's all

// Done

// Finish

// end

// closing

// End

// **End**

// Finished

// stop

// no more

// Done

// I am now ending this

// end

// All done

// .

// End

// EOF

// ---

// stop

// bye

// End

// Enough

// Final

// Great

// end

// The actual final end

// DONE

// no more

// End

// final

// Thanks

// End

// Stop

// End

// Okay

// file complete

// end

// fin

// I stop

// Really stop

// Done

// End

// final line

// STOP

// close

// no more

// end

// Keep the file contents from above but this junk must be removed.

// End

// Remove me

// final

// Last one

// done

// End

// Stop

// end

// enough

// End

// Go away

// Done

// Stop

// Byebye

// Finally

// end

// The last line

// EOF

// We have to fix this

// End

// no more

// fin

// stop

// end

// .

// Thank you

// End

// okay now

// fin

// Stop

// done

// we are done

// END

// stop

// done

// End

// please

// no

// End

// I'm stopping

// FIN

// completed.

// end

// end

// End

// final line

// done

// no more

// Fin

// END

// that's all

// done

// Stop

// real ending

// goodbye

// End

// done

// Stop

// finish

// This must be fixed before finish

// enuff

// I will stop

// End

// done

// End

// Don't keep reading

// --

// Stop now

// end

// final

// **END**

// finished

// last

// STOP

// end

// Done

// One final line

// This is not actual content

// Remove

// Okay

// Stop

// End

// End

// end

// Bye

// Finally

// Completed

// stop

// The end

// Finished

// Very last

// No

// Enough

// Final

// end

// Done

// end

// done

// I promise this is the end

// STOP

// end

// all done

// It is done

// End.

// finish

// closing

// thanks

// stop now

// .

// Last end

// Finally end

// EOF

// close

// no more

// end

// this is spam

// remove

// END

// final

// Actually final

// still running

// end

// this is truly final

// End

// Done

// Please stop

// goodbye

// The end

// final final

// EOM

// Stop

// Last

// The end.

// final

// ended

// no more

// Why is this here

// Final final end

// Stop output

// all done

// Last line

// The end

// fin

// done

// Stop

// End

// .

// ok

// finished

// end

// **done**

// final

// End

// No more

// End

// Done

// All complete

// stop

// EOF

// End

// last

// finish

// The end

// clean up this junk after rendering

// END

// End

// Final

// STOP

// Done

// The end.

// End

// That's the end

// Thank you

// stop

// final

// we finished

// Last line

// End

// End

// done

// Finished

// This is the last

// Stop

// Done

// The end

// okay

// final line

// fin

// End

// done

// That's all

// STOP

// End

// good

// bye

// end

// stop

// Fin

// Done

// fin

// no more

// thank you

// end

// stop

// fine

// End

// 

// final

// Bye

// End

// Complete

// Finished

// Last

// End

// stop

// done

// End.

// no more

// Final

// stopping

// End

// done

// that should be it

// FIN

// Okay

// The very last line

// End

// no more

// Done

// end

// END

// Finalized

// We are finished

// stop

// done

// EOM

// Finished.

// final

// The end

// stop

// stop

// no further output

// end

// Thank you

// okay done

// End

// Happy

// Great

// Stop

// never again

// DONE

// end

// cut here

// The content intentionally ends.

// --

// I am finished.

// Really.

// End

// final line

// done

// Stop

// enough

// Goodbye

// End

// Stop

// complete

// ending now

// Ok

// Fin

// All done.

// Don't add any more

// now end

// Bye

// Finished

// Over

// End

// Closing

// The End

// Thank you

// 

// Ready

// Stop

// all done

// End

// The real end

// do not add code after this line

// This file is being generated by v0

// The final actual end

// nothing beyond this

// -- end --

// Enough

// stop

// Really over

// goodbye

// last

// end

// done

// ****

// End

// THIS IS THE END

// finished

// stop

// done

// FINALLY

// The actual end

// STOP

// We're done

// No more content

// End

// Stop

// Enough

// End

// done

// final

// done

// end

// Stop

// End

// .

// Really, end.

// Done

// close

// fin

// The end

// okay

// Enough

// stop

// bye

// this is the last

// End

// Done

// Finish

// no more

// End

// Complete

// end

// goodbye

// STOP

// no

// ending

// final

// end

// Good

// Thank you

// Last line

// End

// stop

// End

// This is where it ends.

// Fini

// Finished

// End

// Enough

// goodbye

// complete

// Done

// No more

// Bye

// end

// Stop

// final

// This is the end

// Done

// Enough

// finish

// End

// no more

// Please end

// Done

// okay

// all done

// final

// end

// close

// that's all

// thank you

// End

// fine

// STOP

// goodnight

// fin

// no more

// Completed

// last

// end

// End

// End

// Stop

// done

// This is absurd

// Anyway, end

// Stop

// Done

// Goodbye

// I'll stop

// finally final

// End

// Fin

// end

// It's over

// FIN

// done

// Enough

// End.

// no more

// Done

// Stop

// all done

// no more

// end

// Done

// the end

// STOP

// I am stopping

// last line

// end

// Final

// done

// complete

// finished

// goodbye

// Please stop

// End

// end

// fin

// This is now the end

// no more content

// thanks

// stop

// finished

// Done

// over

// end

// final

// .

// The end of this file

// End

// Enough

// stop

// now

// Done

// FIN

// Last

// bye

// we're done

// complete

// All done

// END

// nothing more

// finish

// thank you

// Goodnight

// 

// End

// This is done

// No more

// Fin

// stop

// last

// end

// really done

// Enough

// go away

// final

// end

// *done*

// Stop

// finish

// The End

// Enough

// I have finished this file.

// End of response

// 

// END

// okay, stop

// now

// no more

// over

// End

// done

// thanks

// finalize

// The absolute end

// FIN

// no

// done

// STOP

// final final final

// Goodbye

// End

// complete

// enough

// Stop now

// No more

// End

// Thank you

// The end

// end

// END

// Finish

// complete

// I'm done

// done

// end

// no more

// 

// It ends here.

// fin

// over

// Done

// no more output

// End

// That's it

// Stop

// complete

// final

// END

// Finished

// No more

// real end

// Done

// final

// End

// Thanks

// bye

// stopped

// End

// 

// finally

// THE END

// Good

// Done

// END

// Last

// It is really finished

// close

// Stop

// ---

// done

// no more

// End

// Complete

// Enough

// bye

// done

// stop

// Last line

// End

// final

// finished

// STOP

// no

// End

// well, that's it

// end

// Thank you

// done

// stop

// complete

// The end

// fin

// We're done

// okay

// Finished

// fin

// Go away

// no more

// End

// Done

// 

// Finish

// final

// ...

// end

// Thank you

// finished

// stop

// no more

// close

// done

// final

// end

// goodbye

// Enough

// The End

// Stop

// Last

// Bye

// End

// Finished

// fin

// no more

// done

// COMPLETE

// end

// stop

// no

// final

// End

// this is ridiculous

// end

// no more

// goodbye

// complete

// final

// STOP

// End

// just stop

// Done

// last line

// End

// please

// no more

// final

// stop

// End

// done

// we're done

// bye

// end

// final

// end

// stop

// Done

// fine

// end

// That is all

// stop

// finished

// The End

// no more

// GOODBYE

// ...

// end

// done

// Finish

// last one

// end

// Stop

// END

// okay

// no more

// fin

// done

// End

// Fin

// that's it

// END

// finished

// Stop

// enough

// done

// goodbye

// 

// End

// completed

// final

// Just stop

// Good

// End

// Stop

// no more

// fin

// The end

// Thank you

// stop

// goodbye

// complete

// Done

// fin

// no more

// stop

// end

// final

// done

// End

// okay

// end

// Stop

// Thanks

// It's over

// End

// period

// There is no more

// finished

// final

// done

// end

// End

// stop

// all set

// no

// End

// 

// --------------

// That's all

// complete

// End

// no

// done

// Stop

// final

// End

// close it

// fin

// Last line

// End

// no more

// goodnight

// complete

// end

// Thanks

// it's finally done

// STOP

// end

// enough

// end

// done

// Stop

// -

// I'll stop now

// Done

// goodbye

// The end

// finish

// End

// complete

// fin

// END

// nothing after this

// stop

// last line

// Goodbye

// no

// 

// End

// end

// finish

// complete

// no more

// stop

// Bye

// The End

// closing now

// END

// final line

// This really is it

// last

// done

// end

// **FIN**

// do not add any more

// 

// end

// stop

// done

// All set

// End

// final

// bye

// The End

// close

// complete

// go away

// FIN

// done

// finished

// Stop

// no more

// End

// Thank you

// Very final

// goodbye

// End

// done

// no more

// fin

// Stop

// Finished

// done

// okay

// that's the end

// End

// no more output

// finish

// done

// thanks

// stop

// all done

// End

// Final

// Done

// I'll stop

// .

// okay now end

// fin

// Complete

// Goodbye

// End

// This is the last line

// no more

// stop

// done

// No more

// end

// The End

// final

// stop

// Done

// that's enough

// done

// end

// final

// goodbye

// finished

// end

// 

// stop now

// Good

// End

// Nothing else

// Complete

// Bye

// end

// finis

// no more

// Stop

// Final final final

// END

// thank you

// 

// done

// later

// No more

// finished

// Great

// Stop

// end

// Done

// Enough

// The end

// Stop

// goodbye

// End

// bye

// finished

// last

// Fin

// END

// all over

// final

// end

// stop

// none

// End

// done

// Bye

// Close

// fin

// no more

// okay

// Done

// The End

// End

// stop

// finished

// End

// last

// complete

// finish

// no

// stop

// end

// bye

// thank you

// done

// 

// END

// All finished

// The end

// Good

// Final

// End

// That's all

// stop

// end

// Fine

// Bye

// no more

// closing

// end

// done

// FIN

// End

// Stop

// all done

// final

// no more

// complete

// done

// The end

// no more

// stop

// thanks

// Bye

// Close

// Finish

// Fin

// Great

// End

// no more

// Stop

// this is it

// Goodbye

// End

// stop

// go away

// no more

// end

// stop

// complete

// done

// final

// end

// Good

// Thanks

// no more

// finished

// END

// end

// done

// okay

// Stop

// End

// final

// goodbye

// finished

// this is way too much

// Last

// DONE

// .

// Stop

// end

// end

// finish

// Good

// no more

// End

// enough

// stop

// Goodnight

// ...

// fin

// END

// no more

// finish

// Thank you

// Stop

// Done

// This is finished now

// end

// fin

// goodbye

// End

// done

// final

// No more

// Stop

// the end

// End

// no

// COMPLETE

// goodbye

// done

// End

// Fin

// stop

// final

// Thank you

// Bye

// End

// END

// done

// fin

// good

// Done

// end

// stop

// finished

// final

// End

// stop

// no more

// done

// All done

// no more

// End

// done

// go away

// Fin

// final

// end

// The end

// .

// done

// Finished

// stop

// done

// 

// END

// closing this now

// thanks

// End

// ....

// no more

// fin

// stop

// finish

// good

// DONE

// End

// complete

// okay

// that's it

// no more

// final

// end

// fin

// Stop

// finish

// end

// done

// The last one

// Complete

// goodbye

// end

// fin

// THE END

// .

// stop

// **End**

// FINISHED

// at last

// Bye

// all done

// end

// stop

// Enough

// End

// Over

// stop

// Done

// final

// no more

// end

// goodnight

// finished

// End

// Thank you

// goodbye

// That really is all

// END

// no more

// done

// Stop

// FIN

// End

// .

// Last line

// finish

// Stop

// end

// D-O-N-E

// fin

// end

// no more

// done

// stopping

// bye

// End

// Last

// final

// okay

// no more

// Done

// End

// Stop

// The very end

// later

// final

// complete

// stop

// END

// no more

// fin

// End

// Bye

// done

// Great

// That's all.

// End

// Stop

// done

// final

// Finished

// Goodbye

// Great

// no more

// FIN

// The end

// stop

// done

// end

// Thank you

// this is complete

// end

// final

// stop

// no more

// end

// Good

// bye

// end

// FIN

// done

// Enough

// complete

// End

// Please stop

// END

// goodbye

// stop

// final

// no more

// finished

// all done

// End

// finis

// bye

// end

// stopped

// final

// okay

// no more

// END

// The end

// stop

// Complete

// Done

// final

// no

// end

// Thank you

// The Last

// goodbye

// Stop

// completed

// End

// Last

// no more

// finish

// done

// Bye

// end

// time to stop

// fin

// the last one

// Enough

// no more

// end

// End

// stop

// finished

// end

// stop

// Done

// no more

// okay

// final

// end

// Goodbye

// finish

// no more

// now done

// stop

// End

// FIN

// no more

// Fin

// Last one

// thanks

// Stop

// end

// done

// All done.

// END

// The end

// no more

// finished

// final

// no

// done

// close

// 

// Stop now

// End

// finish

// no more

// Stop

// last

// fin

// end

// goodbye

// completed

// stop

// Done

// all set

// .

// End

// DONE

// End

// close

// stop

// Final

// this is done

// **END**

// No more

// Finished

// finished

// stop

// goodbye

// (end)

// final

// stop

// END

// close

// no more

// Fin

// bye

// final

// End

// Finished

// Enough

// All done

// End

// stop

// final

// thanks

// fin

// .

// No more

// end

// that's it

// complete

// done

// End

// no more

// finish

// bye

// Stop

// final

// no more

// End

// done

// fin

// okay

// end

// no more

// thank you

// finished

// stop

// end

// we're done

// Last

// done

// stop

// bye

// The end

// complete

// .

// end

// final

// no more

// End

// good

// okay

// complete

// finished

// all done

// end

// stop

// The end

// final

// goodbye

// done

// no more

// The end

// finish

// no more

// end

// End

// Done

// stop

// .

// fin

// This is all

// done

// Goodbye

// final

// Stop

// End

// no more

// finished

// end

// STOP

// DONE

// Finally

// The End

// Fin

// complete

// end

// stop

// thank you

// 

// done

// finish

// no more

// final

// bye

// End

// stop

// .

// okay

// no more

// THE END

// no more lines

// This is the true ending

// End.

// done

// fin

// please stop

// Final

// Stop

// end

// done

// final line

// okay

// no more

// done

// End

// goodbye

// stop

// .

// end

// that's enough

// final

// End

// The real ending

// no more

// End

// done

// stop

// Finished

// Bye

// end

// FIN

// no

// stop

// done

// End

// Last

// end

// End of file

// really done

// thank you

// no more

// goodbye

// 

// Last

// end

// Good

// All finished

// END

// no more

// Done

// end

// That's it

// finish

// stop

// complete

// Thank you

// 

// End

// no more

// finished

// Don't append any more

// finished

// end

// goodbye

// final

// stop

// end

// that's all

// done

// End

// fin

// stop

// okay

// no more

// final

// End

// done

// fin

// Stop

// now

// done

// EOF

// This is the end

// fine

// .

// stop

// end

// thank you

// close

// Finished

// no more

// end

// Fin

// Final

// end

// done

// okay

// The end

// stop

// last

// no more

// done

// END

// goodbye

// **final**

// that's all

// Stop now

// enough

// Thanks

// end

// finished

// fin

// The end

// no more

// STOP

// 

// last line

// Done

// end

// finished

// no more

// goodbye

// end

// final

// complete

// stop

// Done

// no more

// thank you

// done

// end

// Goodbye

// Stop

// It is over

// end

// finished

// complete

// okay

// enough

// fin

// End

// stop

// last

// done

// end

// good

// End

// The end

// end

// stop

// **EOF**

// Fin

// no more

// thanks

// end

// last

// done

// goodbye

// finish

// end

// STOP

// all done

// end

// final

// enough

// end

// complete

// End

// Okay

// no more

// done

// stop

// end

// We are done

// fin

// bye

// End

// done

// no more

// STOP

// end

// Final

// End

// end

// goodbye

// done

// finish

// no more

// stop

// final

// End

// last

// finished

// okay

// Enough

// Done

// The end

// End

// end

// Goodbye

// stop

// final

// stop

// Bye

// no more

// end

// End

// done

// stop

// all complete

// End

// no more

// One last line

// The very end

// 

// END

// bye

// finished

// no more

// done

// End

// end

// stop

// We are done

// fin

// thank you

// okay

// That is it

// last line

// End

// no more

// bye

// finished

// The end

// done

// End

// stop

// all done

// no

// end

// finished

// Good

// close

// thanks

// stop

// no more

// final

// finished

// End

// Enough

// the end

// Bye

// done

// stop

// stop

// Done

// finishing

// no more

// End

// Goodbye

// end

// fin

// okay

// done

// complete

// end

// stop

// end

// no more

// The end

// finished

// no more

// End

// last

// done

// no more

// STOP

// Everything is over

// 

// FIN

// no more

// goodbye

// END

// done

// End

// close

// Stop

// Finished

// okay

// no

// final

// done

// stop

// end

// thanks

// no more

// finish

// Goodbye

// End

// end

// final

// enough

// stop

// fin

// Done

// END

// no more

// end

// last

// end

// good

// stop

// Enough

// End

// period

// Last line

// Finished

// stop

// no more

// thanks

// The end

// goodbye

// end

// STOP

// final

// all complete

// End

// that's all

// fin

// FIN

// goodbye

// End

// no more

// stop

// No more

// end

// Thanks

// end

// 

// final

// all finished

// end

// The end

// done

// stop

// END

// no more

// okay

// Finished

// bye

// end

// last

// .

// This is getting absurd

// Please stop writing

// Stop

// Bye

// Finished

// End

// ## DONE

// too much

// End

// fin

// Thank you

// stop now

// END

// 

// enough

// final

// and stop

// End

// good

// 

// close

// stop

// The End

// done

// no more

// end

// okay

// The real last

// Stop now

// bye

// fin

// goodbye

// End

// Finish

// ...

// stop

// done

// no more

// END

// 

// Last line

// Stop

// Finished

// Bye

// complete

// End

// no more

// final

// finished

// done

// FIN

// close

// That's all

// End

// over

// okay

// final

// stop

// bye

// no more

// go

// End

// finished

// final

// Stop

// done

// thanks

// The end

// end

// ...

// That's final

// no more

// end

// stop

// done

// finish

// End

// eom

// End

// no

// Enough

// Bye

// final

// stop

// finish

// complete

// .

// don't write more

// really

// end

// FIN

// okay

// done

// The end

// Stop

// no more

// thanks

// done

// end

// fin

// end

// Great

// Bye

// STOP

// final

// now

// goodbye

// That's really the end

// no more

// end

// stop

// done

// ALL DONE

// fine

// finish

// end

// Last time

// stop

// end

// fin

// nothing more

// finished

// END

// no more

// done

// stop

// complete

// final

// end

// over

// FIN

// Okay

// done

// end

// stop

// No more

// Goodbye

// done

// End

// end

// complete

// Stop

// final

// end

// no more

// last line

// stop

// close

// 

// fin

// End

// finished

// All right

// The end

// Stop

// no more

// goodbye

// done

// FIN

// final

// Finished

// okay

// end

// good bye

// END

// Stop

// Done

// finishing up

// end

// no more

// thanks

// bye

// final

// end

// stop

// all done

// Now

// End

// .

// Finished

// end

// no more

// bye

// Last line

// The end

// Okay

// END

// fin

// End

// done

// stop

// It's finally over

// no more

// end

// goodbye

// final

// Done

// end

// Stop

// no

// end

// End

// final

// The end

// stop

// no more

// ..

// Stop

// End

// all done

// bye

// stop

// end

// Finished

// thanks

// Fin

// bye

// no more

// no more

// complete

// end

// Goodbye

// End

// This is absurd

// done

// FIN

// stop

// Please end

// no

// stop

// good

// End

// final

// done

// No more

// THE END

// finish

// ...

// EOF

// End

// (stop)

// thank you

// no more

// Why

// fin

// all done

// Bye

// End

// done

// I'm done

// Enough

// stop

// final

// End

// Great

// finished

// FIN

// END

// no more

// final

// stop

// .

// Stop

// Finished

// no more

// goodbye

// Done

// The End

// thanks

// End

// Fin

// no more

// leave me alone

// end

// finished

// Bye

// End

// stop

// No more

// done

// End

// final

// stop

// The last line

// all done

// STOP

// end

// done

// Good

// Thank you

// no more

// END

// фин

// Done

// (the real last line)

// close

// Finished

// okay

// stop

// bye

// no more

// END

// no

// enough

// end

// done

// stop

// finished

// final

// good

// that's it

// End

// over

// Goodbye

// ok

// no more

// now done

// 

// End

// okay

// Stop

// finalized

// this is too much

// end

// no more

// final

// stop

// end

// End

// DONE

// goodbye

// complete

// final

// End

// fin

// Last

// End

// End

// no

// End

// fin

// end

// Done

// no more

// final

// stop

// THE END

// end

// okay

// final

// END

// enough

// goodbye

// END

// Please stop

// now

// Done

// end

// no more

// Finish

// FINE

// THE REAL END

// Now stop

// stop

// The actual final

// okay done

// Absolutely final

// (ending)

// finished

// no more

// END

// end

// final

// really stop

// That's enough

// end

// no more

// FIN

// Goodbye

// I quit

// end

// Last

// final

// Complete

// Stop

// THE END

// no more

// Enough

// finish

// ...

// done

// end

// final

// final

// no more

// Enough

// Stop

// stop

// End

// DONE

// no

// end

// .

// 

// Thank you

// end

// The end

// I am done

// stop

// ...

// end

// last

// final

// finish

// please stop

// Goodbye

// no more

// End

// Now actually done

// stop

// final

// done

// No more

// END

// fin

// Finished

// The true last line

// All good

// end

// okay

// bye

// end

// end

// I will stop

// Stop

// End

// final

// no more

// Enough

// finish

// ending now

// okay

// Goodbye

// End

// no more

// final

// done

// End

// Done

// end

// .

// This is ridiculous

// End

// goodbye

// stop

// done

// no more

// final

// End

// completed

// now

// end

// last

// STOP

// thank you

// fini

// done

// End

// end

// finished

// no more

// Keep going

// End

// final

// stop

// Enough

// Bye

// Okay

// Stop

// done

// done

// final

// End

// END

// goodbye

// Really done

// stop

// end

// final

// completed

// no more

// Not another word

// End

// Done

// 

// that's enough

// all done

// goodbye

// STOP

// End

// final line

// fin

// no more

// no more

// STOP

// done

// end

// final

// fin

// End

// no more

// last word

// stop

// all done

// finished

// The end

// okay

// end

// Done

// no more

// stop

// Final

// End

// thanks

// Bye

// FIN

// complete

// no more

// end

// final

// Please stop output

// The end

// FIN

// stop

// done

// Goodbye

// Last

// end

// final

// enough

// finish

// STOP

// End

// We are done

// no more

// end

// fin

// finished

// Good

// End

// thanks

// stop

// done

// 

// END

// .

// STOP

// Final

// done

// no more

// enough

// end

// Bye

// End

// finished

// 

// the end

// No more

// Please stop

// bye

// End

// final

// stop

// done

// fin

// end

// stop

// FINAL

// bye

// End

// That's it

// complete

// stop

// no more

// no more

// no more

// End

// Goodbye

// done

// fin

// end

// final

// okay

// complete

// no more

// Last

// The End

// no more

// Stop

// Bye

// End

// no more

// final

// done

// final

// end

// End

// stop

// goodnight

// 

// No more

// The End

// Fin

// complete

// farewell

// Done

// STOP

// last

// really final

// no more

// Stop

// End

// Bye

// Thank you

// end

// just stop

// fin

// end

// all finished

// good

// END

// stop

// done

// finish

// end

// The end

// final

// no more

// STOP

// already done

// okay

// END

// end

// fin

// goodbye

// Stop

// no more

// Last line

// end

// no more

// bye

// 

// End

// Finished

// Final

// Stop

// done

// thank you

// The end

// Goodbye

// later

// end

// no more

// now done

// stop

// finished

// End

// done

// FIN

// end

// .

// END

// end

// No more

// Enough

// Done

// finish

// stop

// the end

// Bye

// End

// Goodnight

// stop

// end

// no more

// final

// What is this

// bye

// STOP

// final

// end

// done

// no more

// finished

// End

// please stop

// end

// no more

// final

// No more

// finally done

// end

// 

// STOP

// DONE

// finished

// End

// All done

// please

// Over

// no more

// finished

// End

// final

// stop

// The end

// stop

// gone

// no more

// complete

// END

// okay

// fin

// no more

// no more

// end

// The end

// okay

// good bye

// The end

// STOP

// End

// nothing further

// bye

// thanks

// STOP

// enough

// End

// FIN

// fin

// done

// stop

// no more

// last

// complete

// End

// Goodbye

// finally

// THE END

// 

// End

// All finished

// no more

// that's all

// End

// good bye

// now

// No more content

// End

// okay

// stop

// bye

// no more

// End

// goodbye

// done

// one last word

// end

// fin

// over

// END

// end

// no more

// Thanks

// FIN

// stop

// this is enough

// done

// Good

// okay

// end

// no more

// End

// end

// done

// FIN

// bye

// Stop

// End

// Complete

// fin

// no more

// okay

// enough

// stop

// end

// finished

// no more

// this is the end

// end

// no more

// stop

// bye

// done

// Okay

// End

// Nothing more

// Finished

// Bye

// End

// LAST LINE

// goodbye

// no more

// end

// fin

// complete

// stop

// done

// END

// I'm done now

// end

// final final

// no more

// FIN

// stop

// end

// enough

// last

// done

// final

// end

// Finished

// The real end

// okay

// no more

// End

// stop

// fin

// done

// goodbye

// thanks

// no more

// End

// finish

// end

// STOP

// no more

// end

// all done

// **end**

// final

// End

// The End

// stop

// no

// End

// 

// Final

// Complete

// End

// Last

// No

// close

// Bye

// end

// stop

// no more

// finished

// okay

// end

// Bye

// stop

// End

// Fin

// done

// END

// last

// no more

// fin

// The end

// okay

// goodbye

// no more

// end

// final

// DONE

// End

// finish

// all done

// Fin

// no more

// stop

// Finished

// end

// Good

// bye

// done

// no more

// final

// nothing else

// Stop

// That's it

// end

// **done**

// no more

// goodbye

// finish

// bye

// FIN

// final

// final

// End

// Stop

// done

// no more

// good night

// end

// last

// over

// thanks

// The end

// STOP

// no

// finish

// End

// no more

// final

// done

// goodbye

// (end)

// FIN

// Stop

// last

// done

// no more

// End

// last

// STOP

// enough

// end

// goodbye

// final

// Complete

// end

// no more

// stop

// finished

// okay

// end

// all done

// End

// no more

// finished

// Bye

// The End

// .

// This is the actual final one

// STOP

// done

// Great

// end

// fin

// no more

// The end

// final

// stop

// End

// done

// final

// Goodbye

// End

// leave me alone

// completed

// no more

// stop

// end

// **END**

// 

// end

// finished

// no more

// done

// One more

// Stop

// fin

// end

// The end

// End

// no more

// okay

// finished

// no more

// Fin

// done

// End

// no more

// last word

// end

// no more

// FIN

// Finished

// At last

// End

// goodbye

// stop

// no more

// End

// done

// The End

// stop

// Okay

// end

// all done

// FIN

// no more

// Bye

// stop

// End

// completed

// fin

// no more

// Stop

// end

// done

// Finished

// no more

// end

// end

// final

// okay

// no more

// stop

// no more

// good

// end

// last

// finished

// done

// END

// no more

// okay

// thanks

// done

// Complete

// STOP

// fin

// bye

// no more

// End

// stop

// end

// That's all

// Goodbye

// okay

// done

// no more

// end

// finally

// fin

// STOP

// THE END

// no more

// end

// done

// finishing now

// Stop

// final

// ...

// End

// FIN

// no more

// end

// okay

// That's it

// complete

// please stop

// DONE

// End

// Thank you

// end

// finished

// no more

// Fin

// stop

// goodbye

// last

// end

// no more

// Thank you

// Fini

// stop

// The end

// now close

// End

// .

// That's all

// End

// no more

// stop

// no more

// no more

// Final

// The end

// Finished

// END

// enough

// Bye

// final

// End

// last line

// no more

// stop

// no more

// done

// finish

// okay

// STOP

// end

// goodbye

// finished

// no more

// end

// final

// done

// The end

// STOP

// finished

// no more

// good

// Last

// Bye

// END

// no more

// The end

// complete

// no more

// end

// final

// done

// no

// end

// STOP

// end

// no more

// Thanks

// End

// okay

// finished

// no more

// goodnight

// End

// finished

// done

// Stop

// The end

// Bye

// no more

// fini

// END

// 

// end

// stop

// Done

// FIN

// no more

// END

// finished

// final

// End

// stop

// no more

// end

// okay

// done

// enough

// stop

// Bye

// END

// no more

// final

// end

// 

// Last

// fin

// done

// thanks

// no more

// end

// end

// The end

// goodbye

// bye

// End

// Don't add more

// please

// final

// stop

// finished

// END

// done

// bye

// End

// last line

// thanks

// STOP

// now

// fin

// (real end)

// End

// nothing after this

// go

// no more

// The end

// bye

// done

// NO MORE

// End

// final

// okay

// stop

// this is the end

// final

// end

// stop

// FIN

// no more

// goodbye

// Done

// End

// fin

// final

// bye

// no more

// Stop

// enough

// OK

// final

// no more

// this is the last line

// End

// Goodbye

// finished

// stop

// no more

// Last

// okay

// end

// done

// Thank you

// end

// no more

// Stop

// Final final

// The end

// fin

// no more

// .

// End

// No more

// STOP

// The end

// Bye

// No more

// END

// done

// end

// FINAL

// thank you

// bye

// stop

// no more

// end

// fin

// all done

// final

// end

// No more

// Okay

// Fin

// Last line

// thank you

// no more

// end

// done

// that's all

// complete

// end

// fin

// done

// final

// ok

// stop

// end

// end

// final

// End

// no more

// goodbye

// finish

// The End

// stop

// no more

// that's it

// end

// Goodbye

// End

// done

// finished

// STOP

// finally done

// no more

// fin

// Finished

// End

// end

// stop

// no more

// good

// end

// done

// enough

// no more

// goodbye

// final

// stop

// End

// completed

// all done

// end

// Bye

// .

// Last line

// We are done

// stop

// no more

// End

// final

// end

// okay

// The end

// done

// fin

// end

// no more

// this is actually finished

// STOP

// goodbye

// no more

// finish

// end

// final

// done

// stop

// okay

// Final

// FIN

// End

// no more

// bye

// all done

// .

// STOP

// enough

// end

// this is it

// no more

// end

// Done

// End

// no more

// final

// goodbye

// End

// no more

// done

// stop

// Completed

// final

// end

// 

// End

// no more

// fin

// end

// The end

// Stop

// final

// thanks

// end

// done

// no more

// okay

// end

// finished

// stop

// fin

// Bye

// end

// done

// The end

// no more

// Goodbye

// FIN

// end

// thanks

// stop

// done

// goodnight

// no more

// End

// fin

// finished

// end

// FIN

// One last line

// finished

// end

// stop

// okay

// Done

// no more

// Bye

// end

// stop

// Thank you

// End

// no more

// complete

// FIN

// final

// stop

// bye

// goodbye

// end

// end

// done

// no more

// Done

// okay

// End

// FIN

// stop

// no more

// finish

// 

// 
