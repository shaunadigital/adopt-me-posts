// Server-side Blotato client. The only place that talks to Blotato or reads BLOTATO_API_KEY.
// Every call is logged (key hidden). With no key set, calls go to the fake API in demo.ts.
// Endpoints and shapes: docs/blotato-api-notes.md.

import { randomUUID } from 'node:crypto'
import { demoBlotato } from './demo.js'
import { logBlotatoRequest, logBlotatoResponse } from './log.js'
import type {
  BlotatoResult,
  CreatePostRequest,
  CreatePostResponse,
  DemoFailure,
  ListAccountsResponse,
  Platform,
  PostStatusResponse,
  PresignedUploadResponse,
  UploadFromUrlResponse,
} from './types.js'

const BASE_URL = 'https://backend.blotato.com'

export function isDemoMode(): boolean {
  return !process.env.BLOTATO_API_KEY?.trim()
}

export interface CallOptions {
  /** Demo mode only: force this failure. Ignored when a real key is set. */
  demoFail?: DemoFailure | null
}

async function call<T>(method: string, path: string, body: unknown, opts: CallOptions = {}): Promise<BlotatoResult<T>> {
  const demo = isDemoMode()
  const id = randomUUID().slice(0, 8)
  const started = Date.now()
  logBlotatoRequest({ id, demo, method, url: `${BASE_URL}${path}`, body })

  if (demo) {
    const reply = demoBlotato(method, path, body, opts.demoFail ?? null)
    logBlotatoResponse({ id, demo, status: reply.status, ms: Date.now() - started, body: reply.body })
    return { status: reply.status, ok: reply.status < 400, body: reply.body as T, demo }
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'blotato-api-key': process.env.BLOTATO_API_KEY!.trim(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = { message: text.slice(0, 500) || res.statusText }
    }
    logBlotatoResponse({ id, demo, status: res.status, ms: Date.now() - started, body: parsed })
    return { status: res.status, ok: res.ok, body: parsed as T, demo }
  } catch (e) {
    const message = `Could not reach Blotato: ${e instanceof Error ? e.message : String(e)}`
    logBlotatoResponse({ id, demo, status: 502, ms: Date.now() - started, body: { message } })
    return { status: 502, ok: false, body: { message }, demo }
  }
}

/** GET /v2/users/me/accounts */
export function listAccounts(platform?: Platform, opts?: CallOptions) {
  const q = platform ? `?platform=${encodeURIComponent(platform)}` : ''
  return call<ListAccountsResponse>('GET', `/v2/users/me/accounts${q}`, undefined, opts)
}

/** POST /v2/media/uploads: get a presigned URL for a local file. */
export function createUploadUrl(filename: string, opts?: CallOptions) {
  return call<PresignedUploadResponse>('POST', '/v2/media/uploads', { filename }, opts)
}

/** PUT raw bytes to a presigned URL. Returns the HTTP status. No API key goes on this request. */
export async function putToPresignedUrl(presignedUrl: string, bytes: ArrayBuffer, contentType: string) {
  const demo = isDemoMode()
  const id = randomUUID().slice(0, 8)
  const started = Date.now()
  logBlotatoRequest({ id, demo, method: 'PUT', url: presignedUrl, bytes: bytes.byteLength, signed: true })

  if (demo) {
    // Demo presigned URLs aren't real, so nothing is sent. An empty file still fails, like a bad PUT would.
    const status = bytes.byteLength > 0 ? 200 : 400
    logBlotatoResponse({ id, demo, status, ms: Date.now() - started })
    return { status, ok: status === 200 }
  }

  try {
    const res = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes })
    const text = await res.text()
    logBlotatoResponse({ id, demo, status: res.status, ms: Date.now() - started, body: text ? text.slice(0, 500) : undefined })
    return { status: res.status, ok: res.ok }
  } catch (e) {
    logBlotatoResponse({ id, demo, status: 502, ms: Date.now() - started, body: { message: String(e) } })
    return { status: 502, ok: false }
  }
}

/** POST /v2/media: have Blotato fetch media from a public URL. */
export function uploadFromUrl(url: string, opts?: CallOptions) {
  return call<UploadFromUrlResponse>('POST', '/v2/media', { url }, opts)
}

/** POST /v2/posts: publish now, or later when scheduledTime is set. */
export function createPost(request: CreatePostRequest, opts?: CallOptions) {
  return call<CreatePostResponse>('POST', '/v2/posts', request, opts)
}

/** GET /v2/posts/{postSubmissionId} */
export function getPostStatus(postSubmissionId: string, opts?: CallOptions) {
  return call<PostStatusResponse>('GET', `/v2/posts/${encodeURIComponent(postSubmissionId)}`, undefined, opts)
}
