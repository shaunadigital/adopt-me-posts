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
  /** Generated once with the live /api/doctor route and saved here: examples never call Claude. */
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
    saved: null,
  },
  {
    key: 'vague',
    label: "\"My posts aren't showing up\"",
    text: () => "hi my posts aren't showing up on bluesky anymore?? we have dogs that need homes, please help asap\n\nSam",
    saved: null,
  },
  {
    key: 'scheduled',
    label: 'Scheduled post not out yet',
    text: ({ pip }) =>
      `We scheduled a post for Pip a couple of hours ago and it still hasn't gone out. Post ID ${pip ?? 'demo-mw6s2hix-mw9mlls0-ok-97aae7e5'}. Is it stuck?\n\nThanks, Jordan`,
    saved: null,
  },
]
