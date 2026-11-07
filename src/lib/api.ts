// Thin fetch helpers for the app's own /api routes.

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
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0, null)
  }
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message ?? `Request failed (${res.status})`
    throw new ApiError(message, res.status, data)
  }
  return data as T
}

export const getConfig = () => request<AppConfig>('/api/config')

export const getAccounts = () => request<{ items: Account[] }>('/api/accounts?platform=bluesky')

export const writeCaption = (dogSlug: string, previous?: string) =>
  request<CaptionResult>('/api/caption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dogSlug, previous }),
  })

/** Uploads a file's bytes through POST /api/media/upload. Returns Blotato's public media URL. */
export const uploadMedia = (filename: string, file: Blob) =>
  request<{ publicUrl: string }>(`/api/media/upload?filename=${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', ...demoFailHeader() },
    body: file,
  })

export const createPost = (input: { accountId: string; text: string; mediaUrls: string[]; scheduledTime?: string }) =>
  request<CreatePostResult>('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...demoFailHeader() },
    body: JSON.stringify(input),
  })
