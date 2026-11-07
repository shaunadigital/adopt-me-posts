// Thin fetch helpers for the app's own /api routes.
import type { DoctorResult, PostRecord } from './posts'

export interface AppConfig {
  demoMode: boolean
}

export interface Account {
  id: string
  platform: string
  fullname: string
  username: string
}

export interface CaptionResult {
  caption: string
  characters: number
  model: string
  ms: number
}

export interface CreatePostResult {
  postSubmissionId: string
  scheduledTime?: string
}

/** An error from one of our routes, with Blotato's HTTP status and body when it came from Blotato. */
export class ApiError extends Error {
  status: number
  body: unknown
  ms: number
  constructor(message: string, status: number, body: unknown, ms = 0) {
    super(message)
    this.status = status
    this.body = body
    this.ms = ms
  }
}

export interface PostStatusResult {
  postSubmissionId: string
  status: 'in-progress' | 'failed' | 'published' | 'scheduled'
  scheduledTime?: string
  publicUrl?: string
  errorMessage?: string
}

/**
 * Demo mode testing: open the app with ?demoFail=invalid-key (or disconnected-account, bad-media-url,
 * too-long) and posting requests carry that failure. The server ignores it when a real key is set.
 */
function demoFailHeader(): Record<string, string> {
  try {
    const fail = new URLSearchParams(window.location.search).get('demoFail')
    return fail ? { 'x-demo-fail': fail } : {}
  } catch {
    return {}
  }
}

/** A successful response with its HTTP status and how long it took, for the post trace. */
export interface Timed<T> {
  data: T
  status: number
  ms: number
}

async function requestFull<T>(path: string, init?: RequestInit): Promise<Timed<T>> {
  const started = performance.now()
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0, null, ms(started))
  }
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message ?? `Request failed (${res.status})`
    throw new ApiError(message, res.status, data, ms(started))
  }
  return { data: data as T, status: res.status, ms: ms(started) }
}

const ms = (started: number) => Math.round(performance.now() - started)

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await requestFull<T>(path, init)).data
}

export const getConfig = () => request<AppConfig>('/api/config')

export const getAccounts = () => request<{ items: Account[] }>('/api/accounts?platform=bluesky')

/** previous: rewrite with a new angle. trimFrom: shorten that caption (post doctor's "Trim and resend"). */
export const writeCaption = (dogSlug: string, previous?: string, trimFrom?: string) =>
  requestFull<CaptionResult>('/api/caption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dogSlug, previous, trimFrom }),
  })

/** POST /api/doctor with a failed post's evidence. */
export const diagnose = (p: PostRecord) =>
  request<DoctorResult>('/api/doctor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dogName: p.dogName,
      caption: p.caption,
      failedStep: p.failedStep,
      httpStatus: p.httpStatus,
      error: p.error,
      rawError: p.rawError ?? null,
      // Notes and codes only; the doctor doesn't need timestamps or links.
      trace: p.trace.map(({ key, label, state, meta, note }) => ({ key, label, state, meta, note })),
    }),
  })

/** Uploads a file's bytes through POST /api/media/upload. Returns Blotato's public media URL. */
export const uploadMedia = (filename: string, file: Blob) =>
  requestFull<{ publicUrl: string }>(`/api/media/upload?filename=${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', ...demoFailHeader() },
    body: file,
  })

export const createPost = (input: { accountId: string; text: string; mediaUrls: string[]; scheduledTime?: string }) =>
  requestFull<CreatePostResult>('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...demoFailHeader() },
    body: JSON.stringify(input),
  })

/** GET /api/posts/:id. No demoFail header: forced failures are decided when the post is created. */
export const getPostStatus = (postSubmissionId: string) =>
  requestFull<PostStatusResult>(`/api/posts/${encodeURIComponent(postSubmissionId)}`, { cache: 'no-store' })
