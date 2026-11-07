// POST /api/posts → Blotato POST /v2/posts
// Body: { accountId, text, mediaUrls?, scheduledTime?, additionalPosts? }
// Leave out scheduledTime to publish now. Response: { postSubmissionId, scheduledTime? }
import { createPost } from '../_lib/blotato.js'
import { json, readDemoFail, readJson, relay } from '../_lib/http.js'
import type { CreatePostRequest } from '../_lib/types.js'

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

export async function POST(req: Request) {
  const demoFail = readDemoFail(req)
  if (demoFail instanceof Response) return demoFail
  const body = await readJson(req)
  if (body instanceof Response) return body

  const { accountId, text, mediaUrls = [], scheduledTime, additionalPosts } = body
  if (typeof accountId !== 'string' || !accountId) return json(400, { message: 'Add "accountId" from /api/accounts.' })
  if (typeof text !== 'string') return json(400, { message: 'Add "text".' })
  if (!isStringArray(mediaUrls)) return json(400, { message: '"mediaUrls" must be a list of URLs.' })
  if (scheduledTime !== undefined && typeof scheduledTime !== 'string') {
    return json(400, { message: '"scheduledTime" must be an ISO 8601 string.' })
  }
  if (
    additionalPosts !== undefined &&
    !(Array.isArray(additionalPosts) &&
      additionalPosts.every((a) => a && typeof a.text === 'string' && isStringArray(a.mediaUrls ?? [])))
  ) {
    return json(400, { message: '"additionalPosts" must be a list of { text, mediaUrls }.' })
  }

  // Bluesky only for now (no extra target fields needed). See docs/blotato-api-notes.md.
  const request: CreatePostRequest = {
    post: {
      accountId,
      content: {
        text,
        mediaUrls,
        platform: 'bluesky',
        ...(additionalPosts
          ? { additionalPosts: (additionalPosts as { text: string; mediaUrls?: string[] }[]).map((a) => ({ text: a.text, mediaUrls: a.mediaUrls ?? [] })) }
          : {}),
      },
      target: { targetType: 'bluesky' },
    },
    ...(scheduledTime ? { scheduledTime } : {}),
  }

  return relay(await createPost(request, { demoFail }))
}
