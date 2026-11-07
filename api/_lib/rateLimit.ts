// Light abuse guard for routes that spend Anthropic credit. Kept in memory, so it is per
// serverless instance and resets on a cold start (not a shared limit across instances).
const WINDOW_MS = 60_000
const buckets = new Map<string, number[]>()

export function rateLimited(req: Request, bucket: string, maxPerMinute: number): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
  const key = `${bucket}:${ip}`
  const now = Date.now()
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  buckets.set(key, recent)
  return recent.length > maxPerMinute
}
