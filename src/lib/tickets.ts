// "Paste a ticket": find a post ID in what a customer wrote, and the example tickets.
import { DEMO_ID_RE } from '../../shared/demoPostIds'
import type { DoctorResult, PostRecord, PostStatus } from './posts'

// Blotato postSubmissionIds are UUIDs; demo IDs use our own format (shared/demoPostIds.ts).
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
const DEMO = new RegExp(DEMO_ID_RE.source.replace(/^\^|\$$/g, ''), 'i')

export function findPostId(text: string): string | null {
  return DEMO.exec(text)?.[0] ?? UUID.exec(text)?.[0] ?? null
}

/** What the ticket's post ID turned up, shown above the diagnosis. */
export interface TicketLookup {
  postSubmissionId: string
  savedHere: boolean // this browser has the post and its trace
  dogName?: string
  liveStatus?: PostStatus
  liveError?: string
  raw: unknown // what GET /api/posts/:id returned, for "Raw response"
}

export interface TicketResult {
  doctor: DoctorResult
  lookup: TicketLookup | null
}

export interface TicketExample {
  key: 'rocket' | 'vague' | 'scheduled'
  label: string
  /** Built from the post IDs of this browser's example posts, so "Show this post" works. */
  text: (ids: { rocket?: string; pip?: string }) => string
  /**
   * Generated once with the live /api/doctor route and saved here: examples never call Claude.
   * One hand edit: the scheduled example's cause had a UTC time that only matched Hawaii, and the
   * example post is always next Monday 9:00 AM in the viewer's own time zone.
   */
  saved: TicketResult | null
}

export function exampleIds(posts: PostRecord[]) {
  return {
    rocket: posts.find((p) => p.example && p.dogSlug === 'rocket' && p.status === 'failed')?.postSubmissionId,
    pip: posts.find((p) => p.example && p.dogSlug === 'pip' && p.status === 'scheduled')?.postSubmissionId,
  }
}

export const TICKET_EXAMPLES: TicketExample[] = [
  {
    key: 'rocket',
    label: "Rocket's failed post",
    text: ({ rocket }) =>
      `Hi, we posted Rocket this morning but the post never showed up on our Bluesky. The ID it gave us is ${rocket ?? 'demo-mw6uusmx-0-long312-29677d43'}. Did we do something wrong? Rocket really needs a home.\n\nDana, Odd Socks Dog Rescue`,
    saved: {
      "doctor": {
        "matched": true,
        "entries": [
          {
            "id": "text-too-long-20005",
            "title": "Text over the platform's character limit (error code 20005)",
            "inDocs": true,
            "docsNote": "The docs don't say whether this comes back when the post is created or later as the post's errorMessage, or how the platform name is written. Our demo returns it as the failed post's errorMessage with the platform written as 'bluesky'."
          }
        ],
        "cause": "Rocket's caption was 312 characters, and Bluesky only allows 300 characters per post. Blotato accepted the post, but publishing failed when it reached Bluesky, so nothing appeared on your page.",
        "fix": "Shorten Rocket's caption to 300 characters or fewer (about 12 characters needs to go), then send the post again.",
        "reply": "Hi Dana, you did nothing wrong, and thank you for flagging this. Rocket's post didn't go up because the caption was a little too long for Bluesky, which allows 300 characters and his ran to 312. The photo uploaded fine. If you trim the caption by a sentence or a few words and send it again, it should be able to publish. We hope Rocket finds his runner soon. The Adopt Me Posts team",
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
        "generatedAt": "2026-11-07T21:43:51.275Z"
      },
      "lookup": {
        "postSubmissionId": "demo-mw6uusmx-0-long312-29677d43",
        "savedHere": true,
        "dogName": "Rocket",
        "liveStatus": "failed",
        "raw": {
          "postSubmissionId": "demo-mw6uusmx-0-long312-29677d43",
          "status": "failed",
          "errorMessage": "Text length exceeds the character limit of 300 characters for platform bluesky (error code 20005)"
        }
      }
    },
  },
  {
    key: 'vague',
    label: "\"My posts aren't showing up\"",
    text: () => "hi my posts aren't showing up on bluesky anymore?? we have dogs that need homes, please help asap\n\nSam",
    saved: {
      "doctor": {
        "matched": true,
        "entries": [
          {
            "id": "post-not-showing",
            "title": "Post missing, delayed or not showing (symptom)",
            "inDocs": true,
            "docsNote": "This is a symptom customers describe, not an error message Blotato returns."
          }
        ],
        "cause": "The ticket says posts aren't showing on Bluesky, but this symptom alone doesn't show the cause. The post may still be scheduled or in progress, may have published to a different account, or may have failed, and without a post ID we can't tell which.",
        "fix": "Get the post's postSubmissionId and check its status with Get Post Status. Also check the Scheduled, Published and Failed lists for the same account and content, and open any returned platform URL. Don't send a replacement until the original outcome is known.",
        "reply": "Hi Sam, thank you for reaching out, and we're sorry for the worry. We want to get your dogs seen as soon as possible. Could you send us the post ID for a post that isn't showing? If you don't have it, tell us the dog's name and roughly when you posted it. Once we have that, we'll check whether the post is still scheduled, went out to a different account, or didn't go through, and tell you what to do next. Please hold off on reposting for now so you don't end up with duplicates. The Adopt Me Posts team",
        "sources": [
          {
            "title": "Find a post's outcome before retrying",
            "url": "https://help.blotato.com/start-with-an-ai-agent/publishing-status"
          },
          {
            "title": "Error Reference: Post shows \"published\" but does not appear on the platform",
            "url": "https://help.blotato.com/support/errors"
          }
        ],
        "checks": [],
        "model": "claude-sonnet-5-5",
        "generatedAt": "2026-11-07T21:43:56.533Z"
      },
      "lookup": null
    },
  },
  {
    key: 'scheduled',
    label: 'Scheduled post not out yet',
    text: ({ pip }) =>
      `We scheduled a post for Pip a couple of hours ago and it still hasn't gone out. Post ID ${pip ?? 'demo-mw6s2hix-mw9mlls0-ok-97aae7e5'}. Is it stuck?\n\nThanks, Jordan`,
    saved: {
      "doctor": {
        "matched": true,
        "entries": [
          {
            "id": "post-not-showing",
            "title": "Post missing, delayed or not showing (symptom)",
            "inDocs": true,
            "docsNote": "This is a symptom customers describe, not an error message Blotato returns."
          },
          {
            "id": "scheduled-waiting",
            "title": "Scheduled post hasn't gone out yet",
            "inDocs": true
          }
        ],
        "cause": "The post isn't stuck. Blotato shows its status as scheduled, for Monday at 9:00 AM, and a scheduled post waits until that time before going out.",
        "fix": "Check the scheduled time in the customer's own time zone and look at the post again after that time. If the schedule disappears at its due time, check the Published and Failed results before assuming either outcome.",
        "reply": "Hi Jordan, thanks for checking. Pip's post isn't stuck. It was set up correctly and is scheduled to go out on Monday at 9:00 AM, and it will wait until then rather than posting early. Nothing has gone wrong so far. If it isn't up shortly after that time, send us a message with the post ID and we'll look at what happened. The Adopt Me Posts team",
        "sources": [
          {
            "title": "Post lifecycle",
            "url": "https://help.blotato.com/api-and-mcp-concepts/post-lifecycle"
          },
          {
            "title": "Find a post's outcome before retrying",
            "url": "https://help.blotato.com/start-with-an-ai-agent/publishing-status"
          }
        ],
        "checks": [],
        "model": "claude-sonnet-5-5",
        "generatedAt": "2026-11-07T21:44:01.670Z"
      },
      "lookup": {
        "postSubmissionId": "demo-mw6s2hix-mw9mlls0-ok-97aae7e5",
        "savedHere": true,
        "dogName": "Pip",
        "liveStatus": "scheduled",
        "raw": {
          "postSubmissionId": "demo-mw6s2hix-mw9mlls0-ok-97aae7e5",
          "status": "scheduled",
          "scheduledTime": "2026-11-09T19:00:00.000Z"
        }
      }
    },
  },
]
