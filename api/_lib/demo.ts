// Fake Blotato for demo mode (BLOTATO_API_KEY empty).
// Responses match the real API's shapes, status codes and wording, checked against real Blotato on
// 2026-11-07 (see "Checked against real Blotato" in docs/blotato-api-notes.md).
//
// Serverless functions don't share memory, so demo posts are stateless: the postSubmissionId
// encodes when the post was created, when it's scheduled, and how it will end. Any instance
// can then work out the current status from the ID and the clock.

import { randomUUID } from 'node:crypto'
import { DEMO_ID_RE, encodeDemoPostId, type DemoOutcome } from '../../shared/demoPostIds.js'
import { countForBlotato } from '../../shared/textCount.js'
import type {
  BlotatoAccount,
  BlotatoErrorBody,
  CreatePostRequest,
  CreatePostResponse,
  DemoFailure,
  ListAccountsResponse,
  PostStatusResponse,
  PresignedUploadResponse,
  UploadFromUrlResponse,
} from './types.js'

// Real accounts have numeric-string IDs, and Bluesky accounts came back with an empty fullname.
export const DEMO_ACCOUNT: BlotatoAccount = {
  id: '100001',
  platform: 'bluesky',
  fullname: '',
  username: 'adoptmeposts.bsky.social',
}

// How long a post stays "in-progress" before it publishes or fails.
export const DEMO_PUBLISH_DELAY_MS = 4000

const BLUESKY_CHAR_LIMIT = 300

// Real wording, as real Blotato returned it (2026-11-07), or from Blotato's docs where untested.
export const DEMO_MESSAGES = {
  unauthorized: 'Unauthorized', // real: 401 {"message":"Unauthorized"}
  invalidCredentials: 'Invalid account credentials', // docs example; not reproduced for real
  mediaFetchOnPublish: 'Failed to fetch media URL: 404 Not Found', // real: post status errorMessage
  mediaMetadata: 'Failed to read media metadata. Is the file accessible and a valid media file?', // real: 500, code 90000
  urlMissing: '"url" is missing. Add it as a top-level property with the public URL of the media to upload.',
  tooLong: `Text length exceeds the character limit of ${BLUESKY_CHAR_LIMIT} characters for platform 'bluesky'`, // real: 422, code 20005
  tooLongAction:
    'Shorten each post in details.overLimitPosts so its characterCount is at most 300, then retry. characterCount is not string length: emoji and full-width characters such as CJK count as 2.',
} as const

type DemoReply = { status: number; body: unknown }

const reqId = () => `demo-req-${randomUUID().slice(0, 8)}`
// Real error bodies: { statusCode, message, reqId, code?, action?, details? }.
const err = (status: number, { message, ...rest }: BlotatoErrorBody): DemoReply => ({
  status,
  body: { statusCode: status, message, reqId: reqId(), ...rest },
})

// Blotato counts emoji and full-width characters as 2 toward the limit (Error Reference, 20005).
export { countGraphemes } from '../../shared/textCount.js'

function isFetchableUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.hostname.endsWith('.invalid')
  } catch {
    return false
  }
}

function extOf(filename: string): string | null {
  const m = /\.([a-z0-9]{2,5})$/i.exec(filename)
  return m ? m[1].toLowerCase() : null
}

// ---- Post ID encoding: see shared/demoPostIds.ts ----
const ID_RE = DEMO_ID_RE
const encodeId = (created: number, scheduled: number | null, outcome: string) =>
  encodeDemoPostId(created, scheduled, outcome as DemoOutcome)

// ---- Handlers ----

function listAccounts(url: URL): DemoReply {
  const platform = url.searchParams.get('platform')
  const items = platform && platform !== DEMO_ACCOUNT.platform ? [] : [DEMO_ACCOUNT]
  return { status: 200, body: { items } satisfies ListAccountsResponse }
}

function createUploadUrl(body: unknown): DemoReply {
  const filename = (body as { filename?: unknown })?.filename
  if (typeof filename !== 'string' || !filename.trim()) {
    return err(422, { message: '"filename" is missing. Add it as a top-level property, including the file extension.' })
  }
  const ext = extOf(filename) ?? 'bin'
  const key = randomUUID()
  return {
    status: 201,
    body: {
      presignedUrl: `https://database.blotato.io/demo-uploads/${key}.${ext}?X-Amz-Signature=demo`,
      publicUrl: `https://database.blotato.io/demo/${key}.${ext}`,
    } satisfies PresignedUploadResponse,
  }
}

function uploadFromUrl(body: unknown, fail: DemoFailure | null): DemoReply {
  const url = (body as { url?: unknown })?.url
  if (url === undefined || url === '') return err(422, { message: DEMO_MESSAGES.urlMissing })
  // Real: a URL that 404s gives HTTP 500, code 90000 (not the documented 90009).
  if (fail === 'bad-media-url' || !isFetchableUrl(url)) {
    return err(500, { message: DEMO_MESSAGES.mediaMetadata, code: 90000 })
  }
  const key = randomUUID()
  const ext = extOf(new URL(url as string).pathname) ?? 'jpg'
  return {
    status: 201,
    body: { url: `https://database.blotato.io/demo/${key}.${ext}`, id: `media_${key.slice(0, 8)}` } satisfies UploadFromUrlResponse,
  }
}

function createPost(body: unknown, fail: DemoFailure | null, now: number): DemoReply {
  const req = body as Partial<CreatePostRequest> | null
  const post = req?.post
  const missing = [
    !post && 'post',
    post && !post.accountId && 'post.accountId',
    post && typeof post.content?.text !== 'string' && 'post.content.text',
    post && !Array.isArray(post.content?.mediaUrls) && 'post.content.mediaUrls',
    post && !post.content?.platform && 'post.content.platform',
    post && !post.target?.targetType && 'post.target.targetType',
  ].filter(Boolean)
  if (missing.length) {
    return err(422, { message: `"${missing[0]}" is missing.`, details: { missing } })
  }
  const p = post as CreatePostRequest['post']

  let scheduled: number | null = null
  if (req?.scheduledTime !== undefined) {
    scheduled = Date.parse(req.scheduledTime)
    if (Number.isNaN(scheduled)) {
      return err(422, { message: '"scheduledTime" must be an ISO 8601 timestamp.' })
    }
    if (scheduled <= now) scheduled = null // a time in the past publishes now
  }

  // Text over the limit: real Blotato rejects the request right away (422, code 20005) with an
  // action hint and the over-limit posts in details.
  const texts = [p.content.text, ...(p.content.additionalPosts ?? []).map((a) => a.text)]
  const over = texts
    .map((text, index) => ({ index, characterCount: countForBlotato(text), text }))
    .filter((t) => t.characterCount > BLUESKY_CHAR_LIMIT)
  if (fail === 'too-long' && over.length === 0) {
    over.push({ index: 0, characterCount: Math.max(texts[0] ? countForBlotato(texts[0]) : 0, BLUESKY_CHAR_LIMIT + 1), text: texts[0] })
  }
  if (p.content.platform === 'bluesky' && over.length > 0) {
    return err(422, {
      message: DEMO_MESSAGES.tooLong,
      code: 20005,
      action: DEMO_MESSAGES.tooLongAction,
      details: { platform: 'bluesky', maxAllowed: BLUESKY_CHAR_LIMIT, overLimitPosts: over },
    })
  }

  // Decide now how this post will end. These failures surface later as status "failed", like the real queue.
  let outcome = 'ok'
  const mediaUrls = [p.content.mediaUrls, ...(p.content.additionalPosts ?? []).map((a) => a.mediaUrls)].flat()
  if (fail === 'disconnected-account' || p.accountId !== DEMO_ACCOUNT.id) outcome = 'dis'
  else if (fail === 'bad-media-url' || mediaUrls.some((u) => !isFetchableUrl(u))) outcome = 'media'

  const res: CreatePostResponse = { postSubmissionId: encodeId(now, scheduled, outcome) }
  if (scheduled) res.scheduledTime = new Date(scheduled).toISOString()
  return { status: 201, body: res }
}

function getPostStatus(id: string, now: number): DemoReply {
  const m = ID_RE.exec(id)
  // Real: an unknown or made-up ID is 200 with status in-progress, not 404 (Post lifecycle page).
  if (!m) return { status: 200, body: { postSubmissionId: id, status: 'in-progress' } satisfies PostStatusResponse }

  const created = parseInt(m[1], 36)
  const scheduled = m[2] === '0' ? null : parseInt(m[2], 36)
  const outcome = m[3]
  const startsAt = scheduled ?? created

  const res: PostStatusResponse = { postSubmissionId: id, status: 'in-progress' }
  if (scheduled) res.scheduledTime = new Date(scheduled).toISOString()

  if (now < startsAt) {
    res.status = 'scheduled'
  } else if (now < startsAt + DEMO_PUBLISH_DELAY_MS) {
    res.status = 'in-progress'
  } else if (outcome === 'ok') {
    res.status = 'published'
    res.publicUrl = `https://bsky.app/profile/${DEMO_ACCOUNT.username}/post/${m[4]}`
  } else {
    res.status = 'failed'
    // 'long<N>' IDs only exist in posts saved before too-long moved to create time.
    res.errorMessage =
      outcome === 'dis'
        ? DEMO_MESSAGES.invalidCredentials
        : outcome === 'media'
          ? DEMO_MESSAGES.mediaFetchOnPublish
          : DEMO_MESSAGES.tooLong
  }
  return { status: 200, body: res }
}

/** Answer a Blotato request the way the real API would. `path` includes `/v2` and any query string. */
export function demoBlotato(method: string, path: string, body: unknown, fail: DemoFailure | null, now = Date.now()): DemoReply {
  // Real: 401 with only a message, no reqId.
  if (fail === 'invalid-key') return { status: 401, body: { message: DEMO_MESSAGES.unauthorized } }

  const url = new URL(path, 'https://backend.blotato.com')
  const route = `${method} ${url.pathname}`

  if (route === 'GET /v2/users/me/accounts') return listAccounts(url)
  if (route === 'POST /v2/media/uploads') return createUploadUrl(body)
  if (route === 'POST /v2/media') return uploadFromUrl(body, fail)
  if (route === 'POST /v2/posts') return createPost(body, fail, now)
  const status = /^GET \/v2\/posts\/([^/]+)$/.exec(route)
  if (status) return getPostStatus(decodeURIComponent(status[1]), now)

  return { status: 404, body: { statusCode: 404, message: 'Not found' } }
}
