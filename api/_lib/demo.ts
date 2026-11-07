// Fake Blotato for demo mode (BLOTATO_API_KEY empty).
// Responses use the same shapes and status codes as the real API (docs/blotato-api-notes.md).
//
// Serverless functions don't share memory, so demo posts are stateless: the postSubmissionId
// encodes when the post was created, when it's scheduled, and how it will end. Any instance
// can then work out the current status from the ID and the clock.

import { randomUUID } from 'node:crypto'
import { DEMO_ID_RE, encodeDemoPostId, type DemoOutcome } from '../../shared/demoPostIds.js'
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

export const DEMO_ACCOUNT: BlotatoAccount = {
  id: 'demo-bluesky-1',
  platform: 'bluesky',
  fullname: 'Adopt Me Posts',
  username: 'adoptmeposts.bsky.social',
}

// How long a post stays "in-progress" before it publishes or fails.
export const DEMO_PUBLISH_DELAY_MS = 4000

const BLUESKY_CHAR_LIMIT = 300

// Wording from Blotato's docs where it exists. See the table at the end of docs/blotato-api-notes.md.
export const DEMO_MESSAGES = {
  invalidKey: 'Invalid API key',
  invalidCredentials: 'Invalid account credentials',
  mediaFetch:
    'Blotato could not fetch the media URL. Confirm the URL loads or downloads without signing in, then try again.',
  urlMissing: '"url" is missing. Add it as a top-level property with the public URL of the media to upload.',
  // Error Reference, Plan Limit Errors (error code 20005). The docs don't show how the platform name is written.
  tooLong: (_n: number) =>
    `Text length exceeds the character limit of ${BLUESKY_CHAR_LIMIT} characters for platform bluesky (error code 20005)`,
} as const

type DemoReply = { status: number; body: unknown }

const reqId = () => `demo-req-${randomUUID().slice(0, 8)}`
const err = (status: number, body: BlotatoErrorBody): DemoReply => ({ status, body: { reqId: reqId(), ...body } })

// Bluesky counts graphemes, so an emoji counts as one character.
export function countGraphemes(text: string): number {
  return [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].length
}

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
  if (fail === 'bad-media-url' || !isFetchableUrl(url)) {
    return err(422, { code: 90009, message: DEMO_MESSAGES.mediaFetch })
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

  // Decide now how this post will end. Failures surface later as status "failed", like the real queue.
  let outcome = 'ok'
  const texts = [p.content.text, ...(p.content.additionalPosts ?? []).map((a) => a.text)]
  const longest = Math.max(...texts.map(countGraphemes))
  const mediaUrls = [p.content.mediaUrls, ...(p.content.additionalPosts ?? []).map((a) => a.mediaUrls)].flat()

  if (fail === 'disconnected-account' || p.accountId !== DEMO_ACCOUNT.id) outcome = 'dis'
  else if (fail === 'bad-media-url' || mediaUrls.some((u) => !isFetchableUrl(u))) outcome = 'media'
  else if (fail === 'too-long') outcome = `long${Math.max(longest, BLUESKY_CHAR_LIMIT + 1)}`
  else if (p.content.platform === 'bluesky' && longest > BLUESKY_CHAR_LIMIT) outcome = `long${longest}`

  const res: CreatePostResponse = { postSubmissionId: encodeId(now, scheduled, outcome) }
  if (scheduled) res.scheduledTime = new Date(scheduled).toISOString()
  return { status: 201, body: res }
}

function getPostStatus(id: string, now: number): DemoReply {
  const m = ID_RE.exec(id)
  if (!m) return { status: 404, body: { statusCode: 404, message: 'Not found' } }

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
    res.errorMessage =
      outcome === 'dis'
        ? DEMO_MESSAGES.invalidCredentials
        : outcome === 'media'
          ? DEMO_MESSAGES.mediaFetch
          : DEMO_MESSAGES.tooLong(parseInt(outcome.slice(4), 10))
  }
  return { status: 200, body: res }
}

/** Answer a Blotato request the way the real API would. `path` includes `/v2` and any query string. */
export function demoBlotato(method: string, path: string, body: unknown, fail: DemoFailure | null, now = Date.now()): DemoReply {
  if (fail === 'invalid-key') return err(401, { message: DEMO_MESSAGES.invalidKey })

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
