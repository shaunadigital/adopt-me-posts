// Demo mode only: four example posts so a first-time visitor sees every status and a full trace.
// Their IDs use the same encoding as the fake Blotato, so status checks against /api/posts/:id
// answer for them like for any demo post (the in-progress one publishes a few seconds after load).
import { DOGS } from '../../shared/dogs'
import { encodeDemoPostId } from '../../shared/demoPostIds'
import { countCaption } from './text'
import { formatWhen, nextMonday9am, type DoctorResult, type PostRecord, type TraceStep } from './posts'

// 312 characters on purpose: the failed example shows the post doctor's most common case.
const ROCKET_TOO_LONG =
  "Rocket is 1 and lives up to his name. Fetch, zoomies, anyone who will run with him: he's in. He picks up sit and wait fast, has a low-shedding curly coat, and naps hard after a good run. He needs an active home and a fenced yard, and he would love a person who runs or hikes. Message us soon to meet him, please."

// Generated once with the real /api/doctor route (claude-sonnet-5-5) and saved here,
// so the example never calls Claude on load. Regenerate if known-errors.json changes.
export const ROCKET_DOCTOR: DoctorResult = {
  "matched": true,
  "entries": [
    {
      "id": "text-too-long-20005",
      "title": "Text over the platform's character limit (error code 20005)",
      "inDocs": true,
      "docsNote": "Checked against real Blotato on 2026-11-07: a 301-character Bluesky post was rejected right away when it was created: HTTP 422, code 20005, the message above with 'bluesky' in quotes, an action hint, and details.overLimitPosts with each over-limit post's characterCount. No post ID comes back, and the post never reaches Bluesky. The Error Reference doesn't say when this comes back; posts saved by older versions of this app show it as a failed post's errorMessage."
    }
  ],
  "cause": "Rocket's caption is 312 characters, and Bluesky allows 300 per post. Blotato rejected it when creating the post, so it never went out. The photo uploaded fine.",
  "fix": "Shorten the caption by at least 12 characters so the count is 300 or less, then send it again. Nothing was posted, so there is nothing to delete first.",
  "reply": "Hi! Rocket's post didn't go out because the caption was a little too long for Bluesky, which allows 300 characters and his was 312. Nothing was posted, so there is nothing to delete. Please trim at least 12 characters, for example from the last line, and send it again. His photo uploaded fine, so only the text needs a small trim. Thanks for helping Rocket find a home! The Adopt Me Posts team",
  "sources": [
    {
      "title": "Error Reference: Plan Limit Errors",
      "url": "https://help.blotato.com/support/errors"
    },
    {
      "title": "Media Requirements: Bluesky (300 characters per post)",
      "url": "https://help.blotato.com/rest-api-reference/publish-post/media"
    }
  ],
  "checks": [],
  "model": "claude-sonnet-5-5",
  "generatedAt": "2026-11-08T00:13:47.831Z"
}

const dog = (slug: string) => DOGS.find((d) => d.slug === slug)!
const iso = (t: number) => new Date(t).toISOString()

function captionStep(text: string, at: number, claudeMs?: number): TraceStep {
  return {
    key: 'caption',
    label: 'Caption written',
    state: 'ok',
    meta: claudeMs ? `Claude · ${(claudeMs / 1000).toFixed(1)} s` : 'starter',
    http: claudeMs ? 200 : undefined,
    ms: claudeMs,
    note: `${countCaption(text)} characters for Bluesky${claudeMs ? '' : ', hand-written starter'}`,
    at: iso(at),
  }
}

function sentSteps(slug: string, at: number, uploadMs: number, createMs: number, scheduledNote?: string): TraceStep[] {
  return [
    {
      key: 'upload',
      label: 'Photo uploaded',
      state: 'ok',
      meta: `201 · ${uploadMs} ms`,
      http: 201,
      ms: uploadMs,
      note: `${slug}.jpg sent to Blotato storage`,
      at: iso(at + uploadMs),
    },
    {
      key: 'create',
      label: 'Post sent to Blotato',
      state: 'ok',
      meta: `201 · ${createMs} ms`,
      http: 201,
      ms: createMs,
      note: scheduledNote ?? 'Blotato accepted it and passed it to Bluesky',
      at: iso(at + uploadMs + createMs),
    },
  ]
}

export function buildExamples(handle: string, now = Date.now()): PostRecord[] {
  const media = (slug: string) => `https://database.blotato.io/demo/example-${slug}.jpg`

  // 1. Failed: text over Bluesky's 300-character limit. Selected on load.
  // Real Blotato rejects this when the post is created (HTTP 422, code 20005), so there's no
  // postSubmissionId and the post never reaches Bluesky. The body is real Blotato's, checked 2026-11-07.
  const rocketAt = now - 42 * 60_000
  const rocketCount = countCaption(ROCKET_TOO_LONG)
  const tooLong = "Text length exceeds the character limit of 300 characters for platform 'bluesky'"
  const rocketError = `${tooLong} (HTTP 422, code 20005)`
  const rocket: PostRecord = {
    localId: `example-rocket-${rocketAt.toString(36)}`,
    example: true,
    dogSlug: 'rocket',
    dogName: dog('rocket').name,
    caption: ROCKET_TOO_LONG,
    createdAt: iso(rocketAt),
    status: 'failed',
    mediaUrl: media('rocket'),
    failedStep: 'create',
    error: `Post not created: ${rocketError}`,
    doctor: ROCKET_DOCTOR,
    httpStatus: 422,
    rawError: {
      statusCode: 422,
      message: tooLong,
      reqId: 'req-1f3k9a',
      code: 20005,
      action:
        'Shorten each post in details.overLimitPosts so its characterCount is at most 300, then retry. characterCount is not string length: emoji and full-width characters such as CJK count as 2.',
      details: {
        platform: 'bluesky',
        maxAllowed: 300,
        overLimitPosts: [{ index: 0, characterCount: rocketCount, text: ROCKET_TOO_LONG }],
      },
    },
    trace: [
      captionStep(ROCKET_TOO_LONG, rocketAt - 90_000, 1400),
      sentSteps('rocket', rocketAt, 240, 0)[0],
      {
        key: 'create',
        label: 'Post not created',
        state: 'failed',
        meta: '422 · 212 ms',
        http: 422,
        ms: 212,
        note: rocketError,
        at: iso(rocketAt + 452),
      },
      { key: 'result', label: 'Result from Blotato', state: 'skipped', note: 'Not reached' },
    ],
  }

  // 2. In progress: created now, so the fake Blotato publishes it a few seconds after load.
  const biscuitId = encodeDemoPostId(now, null, 'ok')
  const biscuit: PostRecord = {
    localId: `example-biscuit-${biscuitId.slice(-8)}`,
    example: true,
    dogSlug: 'biscuit',
    dogName: dog('biscuit').name,
    caption: dog('biscuit').starterCaption,
    createdAt: iso(now),
    queuedAt: iso(now),
    status: 'in-progress',
    postSubmissionId: biscuitId,
    mediaUrl: media('biscuit'),
    trace: [
      captionStep(dog('biscuit').starterCaption, now - 60_000),
      ...sentSteps('biscuit', now - 500, 310, 190),
      { key: 'result', label: 'Waiting for Bluesky', state: 'waiting', meta: 'in-progress', note: 'Checking with Blotato every few seconds' },
    ],
  }

  // 3. Scheduled for next Monday at 9:00 AM local time.
  const pipAt = now - 2 * 3600_000
  const monday = nextMonday9am(new Date(now)).getTime()
  const pipId = encodeDemoPostId(pipAt, monday, 'ok')
  const pip: PostRecord = {
    localId: `example-pip-${pipId.slice(-8)}`,
    example: true,
    dogSlug: 'pip',
    dogName: dog('pip').name,
    caption: dog('pip').starterCaption,
    createdAt: iso(pipAt),
    status: 'scheduled',
    scheduledTime: iso(monday),
    postSubmissionId: pipId,
    mediaUrl: media('pip'),
    trace: [
      captionStep(dog('pip').starterCaption, pipAt - 45_000, 1200),
      ...sentSteps('pip', pipAt, 265, 201, `Blotato queued it for ${formatWhen(iso(monday), new Date(now))}`),
      { key: 'result', label: 'Scheduled', state: 'scheduled', meta: 'scheduled', note: `Goes out ${formatWhen(iso(monday), new Date(now))}` },
    ],
  }

  // 4. Published yesterday.
  const tankAt = now - 26 * 3600_000
  const tankId = encodeDemoPostId(tankAt, null, 'ok')
  const tankUrl = `https://bsky.app/profile/${handle}/post/${tankId.slice(-8)}`
  const tank: PostRecord = {
    localId: `example-tank-${tankId.slice(-8)}`,
    example: true,
    dogSlug: 'tank',
    dogName: dog('tank').name,
    caption: dog('tank').starterCaption,
    createdAt: iso(tankAt),
    queuedAt: iso(tankAt + 450),
    status: 'published',
    postSubmissionId: tankId,
    mediaUrl: media('tank'),
    publicUrl: tankUrl,
    trace: [
      captionStep(dog('tank').starterCaption, tankAt - 120_000),
      ...sentSteps('tank', tankAt, 252, 198),
      {
        key: 'result',
        label: 'Live on Bluesky',
        state: 'ok',
        meta: 'published · 4 s later',
        http: 200,
        note: 'Blotato confirmed it is live',
        link: tankUrl,
        at: iso(tankAt + 4450),
      },
    ],
  }

  // Newest first, like the real list.
  return [biscuit, pip, rocket, tank]
}
