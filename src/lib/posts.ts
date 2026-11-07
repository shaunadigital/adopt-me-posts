// Post records for the "All posts" list, kept in localStorage for now.

export type PostStatus = 'in-progress' | 'scheduled' | 'published' | 'failed'

/** One step of a post's trace: caption, photo upload, post created, final result from Blotato. */
export type StepKey = 'caption' | 'upload' | 'create' | 'result'
export type StepState = 'ok' | 'failed' | 'waiting' | 'scheduled' | 'skipped'

export interface TraceStep {
  key: StepKey
  label: string
  state: StepState
  /** Mono line on the right: "201 · 188 ms", "Claude · 1.4 s", "failed · 4 s later". */
  meta?: string
  note: string
  http?: number
  ms?: number
  at?: string // ISO, when the step finished
  link?: string // e.g. the published post's URL
}

export interface PostRecord {
  localId: string
  dogSlug: string
  dogName: string
  caption: string
  createdAt: string // ISO, when Post was clicked
  status: PostStatus
  postSubmissionId?: string // Blotato's ID, once the create step succeeds
  scheduledTime?: string // ISO UTC, as sent to and echoed by Blotato
  mediaUrl?: string
  publicUrl?: string // the live Bluesky post, once published
  failedStep?: StepKey
  error?: string // plain-words error, shown on the row
  httpStatus?: number
  /** The raw body of the response that failed, kept for the post doctor (step 6). */
  rawError?: unknown
  trace: TraceStep[]
  example?: boolean // demo-mode example post
  /** When the post was handed to Blotato's queue (create step done, or its scheduled time). */
  queuedAt?: string
  checks?: number // status checks so far
  /** Post doctor result, cached once it has been generated. */
  doctor?: DoctorResult
}

export interface DoctorSource {
  title: string
  url: string
}

export interface DoctorResult {
  matched: boolean
  entries: { id: string; title: string; inDocs: boolean; docsNote?: string }[]
  cause: string
  fix: string
  reply: string
  sources: DoctorSource[]
  checks: string[]
  model: string
  generatedAt: string
}

/** Known-error ids that "Trim and resend" can fix. */
export const TOO_LONG_IDS = ['text-too-long-20005', 'demo-bluesky-too-long']

const KEY = 'adopt-me-posts:posts:v1'
const MAX = 100

export function loadPosts(): PostRecord[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    // Posts saved before traces existed get an empty trace.
    return Array.isArray(parsed) ? (parsed as PostRecord[]).map((p) => ({ ...p, trace: p.trace ?? [] })) : []
  } catch {
    return []
  }
}

// ---- Trace helpers ----

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function formatLater(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s later`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min later`
  return `${Math.round(m / 60)} h later`
}

/** Replace one step (by key) in a post's trace, keeping step order. */
export function setStep(trace: TraceStep[], step: TraceStep): TraceStep[] {
  const i = trace.findIndex((s) => s.key === step.key)
  if (i === -1) return [...trace, step]
  const next = trace.slice()
  next[i] = step
  return next
}

export const RESULT_LABEL = {
  waiting: 'Waiting for Bluesky',
  scheduled: 'Scheduled',
  published: 'Live on Bluesky',
  failed: 'Publishing failed',
  checkFailed: 'Status check failed',
} as const

export function savePosts(posts: PostRecord[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(posts.slice(0, MAX)))
  } catch {
    // storage full or blocked: the list still works for this visit
  }
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  'in-progress': 'In progress',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
}

// ---- Scheduling ----

export type SendOption = 'now' | 'monday' | 'pick'

/** The next Monday at 9:00 AM local time that is still in the future. */
export function nextMonday9am(from = new Date()): Date {
  const d = new Date(from)
  d.setHours(9, 0, 0, 0)
  const daysAhead = (1 - d.getDay() + 7) % 7 // 1 = Monday
  d.setDate(d.getDate() + daysAhead)
  if (d <= from) d.setDate(d.getDate() + 7)
  return d
}

/** Value for <input type="datetime-local">: local wall time, minutes precision. */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The viewer's time zone, e.g. "Pacific/Honolulu (HST)". */
export function localTimeZoneLabel(): string {
  try {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone
    const abbr = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value
    return abbr && abbr !== name ? `${name} (${abbr})` : name
  } catch {
    return 'your local time'
  }
}

// ---- Display ----

const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** "Today 9:12 AM", "Yesterday 4:05 PM", "Mon 9:00 AM" (within a week), else "Nov 18, 9:00 AM". */
export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(d) - startOf(now)) / 86_400_000)
  if (days === 0) return `Today ${time(d)}`
  if (days === -1) return `Yesterday ${time(d)}`
  if (days === 1) return `Tomorrow ${time(d)}`
  if (Math.abs(days) < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time(d)}`
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time(d)}`
}

/** Long IDs shortened for the table; the full ID stays in the title and for screen readers. */
export function shortId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}
