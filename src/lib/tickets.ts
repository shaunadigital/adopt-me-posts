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
  text: (ids: { pip?: string }) => string
  /**
   * Generated once with the live /api/doctor route and saved here: examples never call Claude.
   * Two hand edits: the scheduled example's cause had a UTC time that only matched Hawaii (the
   * example post is always next Monday 9:00 AM in the viewer's own time zone), and the Rocket
   * reply mentioned emoji, which Rocket's caption doesn't have.
   */
  saved: TicketResult | null
}

export function exampleIds(posts: PostRecord[]) {
  return {
    pip: posts.find((p) => p.example && p.dogSlug === 'pip' && p.status === 'scheduled')?.postSubmissionId,
  }
}

export const TICKET_EXAMPLES: TicketExample[] = [
  {
    key: 'rocket',
    label: "Rocket's failed post",
    text: () =>
      "Hi, we tried to post Rocket this morning and it never showed up on our Bluesky. There's no post ID, just a message that says \"Text length exceeds the character limit of 300 characters for platform 'bluesky'\". Did we do something wrong? Rocket really needs a home.\n\nDana, Odd Socks Dog Rescue",
    saved: {
      "doctor": {
        "matched": true,
        "entries": [
          {
            "id": "text-too-long-20005",
            "title": "Text over the platform's character limit (error code 20005)",
            "inDocs": true,
            "docsNote": "Checked against real Blotato on 2026-11-07: a 301-character Bluesky post was rejected right away when it was created: HTTP 422, code 20005, the message above with 'bluesky' in quotes, an action hint, and details.overLimitPosts with each over-limit post's characterCount. No post ID comes back, and the post never reaches Bluesky. The Error Reference doesn't say when this comes back; posts saved by older versions of this app show it as a failed post's errorMessage."
          }
        ],
        "cause": "The Rocket post text is longer than Bluesky's 300 character limit, so Blotato rejected it when it was created and it never went out. Because it was rejected right away, no post ID was created.",
        "fix": "Shorten the text (and any thread posts listed in the error details) to 300 characters or fewer, then send it again. Nothing was posted, so there is nothing to delete first.",
        "reply": "Hi Dana, thanks for writing, and you did nothing wrong. Rocket's post was a bit too long for Bluesky, which allows 300 characters per post, so it was stopped before it went out. That's why it never showed up and there is no post ID. Please shorten the text a little and send it again. Nothing was posted, so there is nothing to delete first. We hope Rocket finds a home soon. The Adopt Me Posts team",
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
        "generatedAt": "2026-11-08T00:13:52.852Z"
      },
      "lookup": null
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
        "cause": "The ticket says posts aren't showing on Bluesky, but there is no post ID, so we can't tell the outcome. This symptom alone doesn't show the cause: a post may still be scheduled or in progress, may have gone to a different account, or may have failed.",
        "fix": "Get the post's postSubmissionId and check its status with Get Post Status. Also check the Scheduled, Published and Failed lists for the same account and content, and open any returned platform URL. Don't send a replacement until the original outcome is known.",
        "reply": "Hi Sam, thank you for reaching out, and we want to help get your dogs seen quickly. Could you send us the post ID for a post that isn't showing? If you don't have it, the dog's name and roughly when you posted works too. Once we have it, we'll check whether the post is still waiting, went to a different account, or didn't go through, and tell you what to do next. Please hold off on reposting for now so we don't create duplicates. The Adopt Me Posts team",
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
        "generatedAt": "2026-11-08T00:13:58.280Z"
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
        "cause": "The post isn't stuck. Blotato reports it as scheduled for Monday at 9:00 AM, and a scheduled post waits until its scheduled time before going out.",
        "fix": "Check the scheduled time in the customer's time zone and check the post again after that time. If the schedule disappears at its due time, check the Published and Failed results before assuming either, and don't send a replacement until the original outcome is known.",
        "reply": "Hi Jordan, thanks for checking. Pip's post isn't stuck. It was set up correctly and is scheduled to go out on Monday at 9:00 AM, so it will wait until then rather than posting earlier. Please check again after that time. If it still hasn't appeared, send us a note and we'll look at what happened. Please don't create a second post for Pip in the meantime, so he doesn't end up posted twice. The Adopt Me Posts team",
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
        "generatedAt": "2026-11-08T00:14:05.340Z"
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
