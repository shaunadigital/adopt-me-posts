// Server-side logging for every Blotato request and response.
// The API key is never logged, and signed upload URLs have their query strings removed.

const MAX_BODY_CHARS = 2000

function redactSignedUrl(url: string): string {
  const q = url.indexOf('?')
  return q === -1 ? url : `${url.slice(0, q)}?[signature redacted]`
}

function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  if (Array.isArray(body)) return body.map(redactBody)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (/api[-_]?key/i.test(k)) out[k] = '[hidden]'
    else if (k === 'presignedUrl' && typeof v === 'string') out[k] = redactSignedUrl(v)
    else out[k] = redactBody(v)
  }
  return out
}

function preview(body: unknown): unknown {
  if (body === undefined) return undefined
  const text = JSON.stringify(redactBody(body))
  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}…(truncated)` : JSON.parse(text)
}

export function logBlotatoRequest(entry: {
  id: string
  demo: boolean
  method: string
  url: string
  body?: unknown
  bytes?: number
  signed?: boolean
}) {
  console.log(
    JSON.stringify({
      blotato: 'request',
      id: entry.id,
      demo: entry.demo,
      method: entry.method,
      url: entry.signed ? redactSignedUrl(entry.url) : entry.url,
      headers: entry.signed ? undefined : { 'blotato-api-key': '[hidden]' },
      body: entry.bytes !== undefined ? `<${entry.bytes} bytes>` : preview(entry.body),
    }),
  )
}

export function logBlotatoResponse(entry: { id: string; demo: boolean; status: number; ms: number; body?: unknown }) {
  console.log(
    JSON.stringify({
      blotato: 'response',
      id: entry.id,
      demo: entry.demo,
      status: entry.status,
      ms: entry.ms,
      body: preview(entry.body),
    }),
  )
}
