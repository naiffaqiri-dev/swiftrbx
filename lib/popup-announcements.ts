export type PopupAnnouncementKind = 'announcement' | 'guide' | 'survey'
export type PopupAnnouncementAudience = 'all' | 'guests' | 'customers' | 'purchasers'
export type PopupAnnouncementRole = 'owner' | 'seller' | 'support' | 'user'
export type PopupAnnouncementFrequency = 'once' | 'daily' | 'session'
export type PopupAnnouncementEventType = 'view' | 'click' | 'complete' | 'dismiss' | 'poll'

export type PopupAnnouncementStep = {
  title: string
  body: string
  imageUrl: string
  buttonLabel: string
  buttonUrl: string
  options: string[]
}

export type PopupAnnouncement = {
  id: string
  title: string
  subject: string
  kind: PopupAnnouncementKind
  audience: PopupAnnouncementAudience
  target_roles: PopupAnnouncementRole[]
  target_user_ids: string[]
  target_emails: string[]
  excluded_roles: PopupAnnouncementRole[]
  excluded_user_ids: string[]
  frequency: PopupAnnouncementFrequency
  steps: PopupAnnouncementStep[]
  starts_at: string | null
  ends_at: string | null
  active: boolean
  priority: number
  created_at: string
  metrics?: { views: number; clicks: number; completions: number; polls: number }
}

export type PopupAnnouncementDraft = Omit<PopupAnnouncement, 'id' | 'created_at' | 'metrics'>

export const EMPTY_ANNOUNCEMENT_STEP: PopupAnnouncementStep = {
  title: '',
  body: '',
  imageUrl: '',
  buttonLabel: '',
  buttonUrl: '',
  options: ['', ''],
}

export function isSafeAnnouncementUrl(value: string) {
  const url = value.trim()
  if (!url) return true
  if (url.startsWith('/') && !url.startsWith('//')) return true
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function announcementImageUrl(value: string) {
  const url = value.trim()
  if (!url) return ''
  if (url.startsWith('/') && !url.startsWith('//')) return url
  try {
    return new URL(url).protocol === 'https:' ? url : ''
  } catch {
    return ''
  }
}

export function announcementLinkTarget(value: string) {
  const url = value.trim()
  return url.startsWith('/') && !url.startsWith('//') ? '_self' : '_blank'
}

export function announcementDateTimeInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function announcementAudienceLabel(audience: PopupAnnouncementAudience, lang: 'ar' | 'en') {
  const labels = {
    all: { ar: 'الجميع', en: 'Everyone' },
    guests: { ar: 'الزوار فقط', en: 'Visitors only' },
    customers: { ar: 'العملاء المسجلون', en: 'Signed-in customers' },
    purchasers: { ar: 'العملاء المشترون', en: 'Customers who purchased' },
  }
  return labels[audience][lang]
}

export function announcementKindLabel(kind: PopupAnnouncementKind, lang: 'ar' | 'en') {
  const labels = {
    announcement: { ar: 'إعلان', en: 'Announcement' },
    guide: { ar: 'شرح متعدد الخطوات', en: 'Step-by-step guide' },
    survey: { ar: 'استطلاع رأي', en: 'Poll' },
  }
  return labels[kind][lang]
}

export function emptyPopupAnnouncement(): PopupAnnouncementDraft {
  return {
    title: '',
    subject: '',
    kind: 'announcement',
    audience: 'all',
    target_roles: [],
    target_user_ids: [],
    target_emails: [],
    excluded_roles: [],
    excluded_user_ids: [],
    frequency: 'session',
    steps: [{ ...EMPTY_ANNOUNCEMENT_STEP }],
    starts_at: null,
    ends_at: null,
    active: false,
    priority: 0,
  }
}

export function validatePopupAnnouncementDraft(value: unknown): PopupAnnouncementDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Partial<PopupAnnouncementDraft>
  if (
    typeof draft.title !== 'string' || !draft.title.trim() || draft.title.trim().length > 120 ||
    typeof draft.subject !== 'string' || draft.subject.length > 180 ||
    !['announcement', 'guide', 'survey'].includes(draft.kind ?? '') ||
    !['all', 'guests', 'customers', 'purchasers'].includes(draft.audience ?? '') ||
    (draft.frequency !== undefined && !['once', 'daily', 'session'].includes(draft.frequency)) ||
    (draft.target_roles !== undefined && (!Array.isArray(draft.target_roles) || draft.target_roles.length > 4 || draft.target_roles.some((role) => !['owner', 'seller', 'support', 'user'].includes(String(role))))) ||
    (draft.target_user_ids !== undefined && (!Array.isArray(draft.target_user_ids) || draft.target_user_ids.length > 500 || draft.target_user_ids.some((id) => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))) ||
    (draft.excluded_roles !== undefined && (!Array.isArray(draft.excluded_roles) || draft.excluded_roles.length > 4 || draft.excluded_roles.some((role) => !['owner', 'seller', 'support', 'user'].includes(String(role))))) ||
    (draft.excluded_user_ids !== undefined && (!Array.isArray(draft.excluded_user_ids) || draft.excluded_user_ids.length > 500 || draft.excluded_user_ids.some((id) => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))) ||
    (draft.target_emails !== undefined && (!Array.isArray(draft.target_emails) || draft.target_emails.length > 500 || draft.target_emails.some((email) => typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))) ||
    typeof draft.active !== 'boolean' ||
    !Number.isInteger(draft.priority) || (draft.priority ?? 0) < -10_000 || (draft.priority ?? 0) > 10_000 ||
    !Array.isArray(draft.steps) || draft.steps.length < 1 || draft.steps.length > 12
  ) return null

  const startsAt = normalizeDate(draft.starts_at)
  const endsAt = normalizeDate(draft.ends_at)
  if (startsAt === undefined || endsAt === undefined || (startsAt && endsAt && startsAt >= endsAt)) return null

  const steps: PopupAnnouncementStep[] = []
  for (const rawStep of draft.steps) {
    if (!rawStep || typeof rawStep !== 'object') return null
    const step = rawStep as Partial<PopupAnnouncementStep>
    if (
      typeof step.title !== 'string' || !step.title.trim() || step.title.length > 120 ||
      typeof step.body !== 'string' || step.body.length > 3000 ||
      typeof step.imageUrl !== 'string' || step.imageUrl.length > 2048 || !isSafeAnnouncementUrl(step.imageUrl) ||
      typeof step.buttonLabel !== 'string' || step.buttonLabel.length > 60 ||
      typeof step.buttonUrl !== 'string' || step.buttonUrl.length > 2048 || !isSafeAnnouncementUrl(step.buttonUrl) ||
      !Array.isArray(step.options) || step.options.length > 8 ||
      step.options.some((option) => typeof option !== 'string' || option.length > 120)
    ) return null

    const options = step.options.map((option) => option.trim()).filter(Boolean)
    if (draft.kind === 'survey' && (options.length < 2 || options.length > 8)) return null
    steps.push({
      title: step.title.trim(),
      body: step.body,
      imageUrl: step.imageUrl.trim(),
      buttonLabel: step.buttonLabel.trim(),
      buttonUrl: step.buttonUrl.trim(),
      options,
    })
  }

  return {
    title: draft.title.trim(),
    subject: draft.subject.trim(),
    kind: draft.kind as PopupAnnouncementKind,
    audience: draft.audience as PopupAnnouncementAudience,
    target_roles: [...new Set((draft.target_roles ?? []) as PopupAnnouncementRole[])],
    target_user_ids: [...new Set((draft.target_user_ids ?? []).map((id) => id.toLowerCase()))],
    target_emails: [...new Set((draft.target_emails ?? []).map((email) => email.trim().toLowerCase()))],
    excluded_roles: [...new Set((draft.excluded_roles ?? []) as PopupAnnouncementRole[])],
    excluded_user_ids: [...new Set((draft.excluded_user_ids ?? []).map((id) => id.toLowerCase()))],
    frequency: (draft.frequency ?? 'session') as PopupAnnouncementFrequency,
    steps,
    starts_at: startsAt,
    ends_at: endsAt,
    active: draft.active,
    priority: draft.priority as number,
  }
}

function normalizeDate(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function formatAnnouncementDate(value: string | null, lang: 'ar' | 'en') {
  if (!value) return lang === 'ar' ? 'بدون موعد' : 'No date set'
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatAnnouncementDateRange(
  startsAt: string | null,
  endsAt: string | null,
  lang: 'ar' | 'en',
) {
  const starts = formatAnnouncementDate(startsAt, lang)
  const ends = formatAnnouncementDate(endsAt, lang)
  return `${starts} — ${ends}`
}

export function isPopupAnnouncement(value: unknown): value is PopupAnnouncement {
  return Boolean(
    value && typeof value === 'object' &&
    typeof (value as PopupAnnouncement).id === 'string' &&
    Array.isArray((value as PopupAnnouncement).steps) &&
    ['announcement', 'guide', 'survey'].includes((value as PopupAnnouncement).kind),
  )
}

export function validPopupSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function isPopupAnnouncementEvent(value: unknown): value is PopupAnnouncementEventType {
  return ['view', 'click', 'complete', 'dismiss', 'poll'].includes(String(value))
}
export function isPopupAnnouncementAudience(value: unknown): value is PopupAnnouncementAudience {
  return ['all', 'guests', 'customers', 'purchasers'].includes(String(value))
}

export function isPopupAnnouncementKind(value: unknown): value is PopupAnnouncementKind {
  return ['announcement', 'guide', 'survey'].includes(String(value))
}

export function isSafePopupStepIndex(value: unknown, stepCount: number): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value < stepCount
}

export function isSafePopupChoice(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 120
}

export function isPopupAnnouncementId(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function audienceMatchesAnnouncement(
  audience: PopupAnnouncementAudience,
  isCustomer: boolean,
  isPurchaser = false,
) {
  return audience === 'all' ||
    (audience === 'customers' && isCustomer) ||
    (audience === 'purchasers' && isCustomer && isPurchaser) ||
    (audience === 'guests' && !isCustomer)
}

export function popupAnnouncementTargetsViewer(
  announcement: Pick<PopupAnnouncement, 'target_roles' | 'target_user_ids' | 'target_emails' | 'excluded_roles' | 'excluded_user_ids'>,
  viewer: { id?: string; role?: string; email?: string | null },
) {
  const roles = announcement.target_roles ?? []
  const userIds = announcement.target_user_ids ?? []
  const emails = announcement.target_emails ?? []
  const excludedRoles = announcement.excluded_roles ?? []
  const excludedUserIds = announcement.excluded_user_ids ?? []
  if ((viewer.role && excludedRoles.includes(viewer.role as PopupAnnouncementRole)) ||
    (viewer.id && excludedUserIds.includes(viewer.id))) return false
  if (!roles.length && !userIds.length && !emails.length) return true
  if (!viewer.id) return false
  return (roles.length > 0 && !!viewer.role && roles.includes(viewer.role as PopupAnnouncementRole)) ||
    userIds.includes(viewer.id) ||
    (emails.length > 0 && !!viewer.email && emails.includes(viewer.email.trim().toLowerCase()))
}

export function popupAnnouncementFrequencyLabel(frequency: PopupAnnouncementFrequency, lang: 'ar' | 'en') {
  const labels = {
    once: { ar: 'مرة واحدة للحساب (والزوار للجلسة)', en: 'Once per account (guests per session)' },
    daily: { ar: 'مرة كل 24 ساعة (للزوار للجلسة)', en: 'Every 24 hours (guests per session)' },
    session: { ar: 'في كل جلسة زيارة', en: 'Every visit session' },
  }
  return labels[frequency][lang]
}

export function isPopupAnnouncementInSchedule(announcement: Pick<PopupAnnouncement, 'starts_at' | 'ends_at'>, now = Date.now()) {
  return (!announcement.starts_at || Date.parse(announcement.starts_at) <= now) &&
    (!announcement.ends_at || Date.parse(announcement.ends_at) > now)
}

export function isSafePopupSession(sessionId: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
}

export function createPopupSessionId() {
  return crypto.randomUUID()
}

export function eventStepForAnnouncement(announcement: PopupAnnouncement, stepIndex: number) {
  return Math.max(0, Math.min(announcement.steps.length - 1, stepIndex))
}

export function announcementStepCountLabel(count: number, lang: 'ar' | 'en') {
  return lang === 'ar' ? `${count} ${count === 1 ? 'خطوة' : 'خطوات'}` : `${count} ${count === 1 ? 'step' : 'steps'}`
}

export function parseAnnouncementError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error
  }
  return fallback
}

export function popupAnnouncementStorageKey(id: string) {
  return `swiftrbx-popup-seen:${id}`
}

export function readPopupAnnouncementSeen(id: string) {
  try {
    return window.sessionStorage.getItem(popupAnnouncementStorageKey(id)) === '1'
  } catch {
    return false
  }
}

export function markPopupAnnouncementSeen(id: string) {
  try {
    window.sessionStorage.setItem(popupAnnouncementStorageKey(id), '1')
  } catch {
    // A blocked storage API should not keep the campaign from closing.
  }
}

export function popupCampaignSessionKey() {
  return 'swiftrbx-popup-session'
}

export function readPopupAnnouncementSessionId() {
  try {
    const existing = window.sessionStorage.getItem(popupCampaignSessionKey())
    if (existing && validPopupSessionId(existing)) return existing
    const generated = crypto.randomUUID()
    window.sessionStorage.setItem(popupCampaignSessionKey(), generated)
    return generated
  } catch {
    return crypto.randomUUID()
  }
}

export function popupEventLabels(lang: 'ar' | 'en') {
  return lang === 'ar'
    ? { views: 'مشاهدة', clicks: 'نقرة', completions: 'إكمال', polls: 'تصويت' }
    : { views: 'views', clicks: 'clicks', completions: 'completions', polls: 'votes' }
}

export function popupCampaignStatus(announcement: PopupAnnouncement, lang: 'ar' | 'en') {
  if (!announcement.active) return lang === 'ar' ? 'مسودة / متوقف' : 'Draft / paused'
  if (announcement.starts_at && Date.parse(announcement.starts_at) > Date.now()) return lang === 'ar' ? 'مجدول' : 'Scheduled'
  if (announcement.ends_at && Date.parse(announcement.ends_at) <= Date.now()) return lang === 'ar' ? 'منتهي' : 'Ended'
  return lang === 'ar' ? 'منشور' : 'Published'
}

export function popupCampaignIsLive(announcement: PopupAnnouncement, now = Date.now()) {
  return announcement.active && isPopupAnnouncementInSchedule(announcement, now)
}

export function popupCampaignButtonCopy(kind: PopupAnnouncementKind, lang: 'ar' | 'en') {
  if (kind === 'survey') return lang === 'ar' ? 'إرسال التصويت' : 'Submit vote'
  return lang === 'ar' ? 'تم' : 'Done'
}

export function popupCampaignForwardCopy(lang: 'ar' | 'en') {
  return lang === 'ar' ? 'التالي' : 'Next'
}

export function popupCampaignBackCopy(lang: 'ar' | 'en') {
  return lang === 'ar' ? 'السابق' : 'Back'
}

export function popupCampaignCloseCopy(lang: 'ar' | 'en') {
  return lang === 'ar' ? 'إغلاق الإعلان' : 'Close announcement'
}
