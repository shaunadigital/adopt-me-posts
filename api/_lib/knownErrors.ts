// Matches a failed post's error against docs/known-errors.json.
// Matching is plain code: Claude never picks entries, it only explains the ones matched here.
import data from '../../docs/known-errors.json' with { type: 'json' }

export interface KnownErrorSource {
  title: string
  url: string
}

export interface KnownError {
  id: string
  title: string
  wording: string[]
  match: { httpStatus: number[]; codes: number[]; patterns: string[]; regex?: string[] }
  stage: string
  cause: string
  fix: string
  sources: KnownErrorSource[]
  inDocs: boolean
  docsNote?: string
}

export const KNOWN_ERRORS = data.entries as KnownError[]

export interface ErrorEvidence {
  messages: string[] // every error string we have: message, errorMessage, row error
  httpStatus?: number
  code?: number
}

/** Pull error strings, HTTP status and Blotato error code out of a saved raw response. */
export function evidenceFrom(rawError: unknown, httpStatus: unknown, extra: unknown[] = []): ErrorEvidence {
  const messages: string[] = []
  let code: number | undefined
  const walk = (v: unknown, depth: number) => {
    if (depth > 3 || v == null) return
    if (typeof v === 'string') {
      messages.push(v)
      return
    }
    if (typeof v !== 'object') return
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if ((k === 'code' || k === 'errorCode') && typeof val === 'number') code ??= val
      if (['message', 'errorMessage', 'error', 'details'].includes(k)) walk(val, depth + 1)
    }
  }
  walk(rawError, 0)
  for (const e of extra) if (typeof e === 'string' && e) messages.push(e)
  // "(error code 20005)" written inside a message counts as the code too.
  for (const m of messages) {
    const c = /error code (\d+)/i.exec(m)
    if (c) code ??= Number(c[1])
  }
  return {
    messages: messages.map((m) => m.slice(0, 1000)),
    httpStatus: typeof httpStatus === 'number' ? httpStatus : undefined,
    code,
  }
}

/**
 * Score each entry: a Blotato error code or a message pattern is strong evidence (3 / 2 points);
 * an HTTP status alone is weak (1 point) and only counts when nothing stronger matched.
 */
export function matchKnownErrors(ev: ErrorEvidence, max = 3): KnownError[] {
  const text = ev.messages.join('\n').toLowerCase()
  const scored = KNOWN_ERRORS.map((e) => {
    let strong = 0
    if (ev.code !== undefined && e.match.codes.includes(ev.code)) strong += 3
    if (e.match.patterns.some((p) => p && text.includes(p.toLowerCase()))) strong += 2
    if ((e.match.regex ?? []).some((r) => new RegExp(r, 'i').test(text))) strong += 2
    const weak = ev.httpStatus !== undefined && e.match.httpStatus.includes(ev.httpStatus) ? 1 : 0
    return { e, strong, weak }
  })
  const strong = scored.filter((s) => s.strong > 0).sort((a, b) => b.strong + b.weak - (a.strong + a.weak))
  if (strong.length) return strong.slice(0, max).map((s) => s.e)
  return scored.filter((s) => s.weak > 0).slice(0, max).map((s) => s.e)
}
