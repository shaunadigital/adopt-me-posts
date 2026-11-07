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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message ?? `Request failed (${res.status})`
    throw new Error(message)
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
