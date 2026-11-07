// Shapes from Blotato's OpenAPI spec. See docs/blotato-api-notes.md.

export type Platform =
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'tiktok'
  | 'pinterest'
  | 'threads'
  | 'bluesky'
  | 'youtube'
  | 'other'

export interface BlotatoAccount {
  id: string
  platform: Platform
  fullname: string
  username: string
}

export interface ListAccountsResponse {
  items: BlotatoAccount[]
}

export interface PresignedUploadResponse {
  presignedUrl: string
  publicUrl: string
}

export interface UploadFromUrlResponse {
  url: string
  id?: string
}

export interface PostContent {
  text: string
  mediaUrls: string[]
  platform: Platform
  additionalPosts?: { text: string; mediaUrls: string[] }[]
}

export interface CreatePostRequest {
  post: {
    accountId: string
    content: PostContent
    target: { targetType: Platform }
  }
  scheduledTime?: string
}

export interface CreatePostResponse {
  postSubmissionId: string
  scheduledTime?: string
}

export type PostStatus = 'in-progress' | 'failed' | 'published' | 'scheduled'

export interface PostStatusResponse {
  postSubmissionId: string
  status: PostStatus
  scheduledTime?: string
  publicUrl?: string
  errorMessage?: string
}

// Error body. Only `message` is required. Some documented examples use `statusCode` instead of `code`.
export interface BlotatoErrorBody {
  message: string
  code?: number
  statusCode?: number
  reqId?: string
  action?: string
  subscriptionStatus?: string
  details?: Record<string, unknown>
}

// What every client call returns: Blotato's HTTP status and its JSON body, untouched.
export interface BlotatoResult<T> {
  status: number
  ok: boolean
  body: T | BlotatoErrorBody
  demo: boolean
}

export const DEMO_FAILURES = ['invalid-key', 'disconnected-account', 'bad-media-url', 'too-long'] as const
export type DemoFailure = (typeof DEMO_FAILURES)[number]
