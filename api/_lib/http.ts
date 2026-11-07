// Small helpers shared by the API routes.

import { isDemoMode } from './blotato.js'
import { DEMO_FAILURES, type BlotatoResult, type DemoFailure } from './types.js'

export function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Pass Blotato's status and body straight through, so the frontend sees the real error shapes. */
export function relay<T>(result: BlotatoResult<T>): Response {
  return json(result.status, result.body)
}

/**
 * Demo mode only: a request can force a failure with ?demoFail=<name> or an x-demo-fail header.
 * Names: invalid-key, disconnected-account, bad-media-url, too-long.
 * Returns a 400 Response when the name is unknown.
 */
export function readDemoFail(req: Request): DemoFailure | null | Response {
  const raw = new URL(req.url).searchParams.get('demoFail') ?? req.headers.get('x-demo-fail')
  if (!raw) return null
  if (!isDemoMode()) return null // can't fake failures against the real API
  if ((DEMO_FAILURES as readonly string[]).includes(raw)) return raw as DemoFailure
  return json(400, { message: `Unknown demoFail "${raw}". Use one of: ${DEMO_FAILURES.join(', ')}.` })
}

export async function readJson(req: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body = await req.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch {
    // fall through
  }
  return json(400, { message: 'Request body must be a JSON object.' })
}
