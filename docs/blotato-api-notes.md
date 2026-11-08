# Blotato API notes

These are the parts of the Blotato API this app uses, copied from Blotato's own docs on 2026-11-07. If the docs change, they win over these notes.

Sources:
- OpenAPI spec (v2.0.0): https://backend.blotato.com/openapi.json
- API guide for agents: https://help.blotato.com/api/llm.md
- Platform media and text limits: https://help.blotato.com/rest-api-reference/publish-post/media.md

## Basics

- Base URL: `https://backend.blotato.com` (the paths below include `/v2`)
- Auth: header `blotato-api-key: <key>` (spec `securitySchemes.apiKey`). Copy the full key, including any trailing `=`; dropping it causes a 401 "invalid API key" error (guide, MCP troubleshooting).
- API access needs a paid plan. Generating a key during the free trial ends the trial and starts billing (guide, "API access and authentication").
- Never share signed upload URLs (guide, support triage). This app redacts their query strings in logs.

## Error body shape

All error responses in the spec use this shape (only `message` is required):

```json
{ "code": 0, "reqId": "string", "message": "string", "action": "string", "details": {} }
```

403 responses can also carry `subscriptionStatus`. Some examples in the guide use `statusCode` instead of `code`, for example `{ "statusCode": 404, "message": "Not found" }` and `{ "statusCode": 429, "message": "Rate limit exceeded, retry in 49 seconds" }`.

| Status | Meaning (guide, "Errors and retries") |
| --- | --- |
| 401 | Invalid API key or invalid session. Recopy the full key. |
| 403 | Subscription problem. Check Billing. |
| 404 | Re-fetch the record and check the ID type. |
| 422 | Validation error. Fix the named field. |
| 429 | Rate limited. Wait for the retry interval. |
| 5xx | Retry reads with a delay. After a create request, check before resubmitting. |

## 1. List connected accounts

`GET /v2/users/me/accounts?platform=bluesky` (`platform` is optional)

Response 200:

```json
{ "items": [ { "id": "12345", "platform": "twitter", "fullname": "John Doe", "username": "@johndoe" } ] }
```

All four item fields are required. `platform` is one of: twitter, instagram, linkedin, facebook, tiktok, pinterest, threads, bluesky, youtube, other. An empty `items` list is a successful response with no connected accounts.

## 2a. Upload a local file (presigned URL)

`POST /v2/media/uploads` with body `{ "filename": "my-video.mp4" }`. The extension sets the content type.

Response 201:

```json
{ "presignedUrl": "https://...", "publicUrl": "https://database.blotato.io/..." }
```

Then `PUT` the raw file bytes to `presignedUrl`, not JSON and not multipart. The guide's MCP section says to send the correct `Content-Type`. Then use `publicUrl` in the post's `mediaUrls`. The presigned URL expires after a short time. There's no upload-status endpoint. Rate limit: 120 requests/min.

## 2b. Upload media from a public URL

`POST /v2/media` with body `{ "url": "https://example.com/image.jpg" }`

Response 201 (spec): `{ "url": "https://database.blotato.io/media/12345.jpg", "id": "media_12345" }`. The guide's example shows only `url`.

Missing `url` (spec errorMessage): `"url" is missing. Add it as a top-level property with the public URL of the media to upload.`

Error codes (guide, Upload Media):

| Code | Description |
| --- | --- |
| `90009` | Blotato could not fetch the media URL. Confirm the URL loads or downloads without signing in, then try again. |
| `9999` | Unknown error. Example body: `{ "code": 9999, "message": "An unknown error occurred." }` (HTTP 500) |

The docs don't give the HTTP status for `90009`. Real Blotato answered a URL that 404s with 500 and code 90000 instead (see "Checked against real Blotato"). Limit: 1GB. The spec says 10 requests/min and the guide says 30.

The docs disagree on whether media must be uploaded first. The spec says `mediaUrls` "must originate from the blotato domain". The guide's Bluesky section and media table say public URLs can go straight into `mediaUrls`. This app uploads first, which is safe either way.

## 3. Create a post

`POST /v2/posts`

```json
{
  "post": {
    "accountId": "ACCOUNT_ID_FROM_LOOKUP",
    "content": {
      "platform": "bluesky",
      "text": "A post for Bluesky.",
      "mediaUrls": [],
      "additionalPosts": [ { "text": "...", "mediaUrls": [] } ]
    },
    "target": { "targetType": "bluesky" }
  },
  "scheduledTime": "2026-11-13T22:08:43.977Z"
}
```

- Required: `post.accountId`, `post.content.text`, `post.content.mediaUrls`, `post.content.platform`, `post.target.targetType`.
- Bluesky needs no extra target fields.
- Omit `scheduledTime` (and `slot`) to publish now. `useNextFreeSlot: true` uses the next queue slot.
- `additionalPosts` (max 10) makes a thread on Twitter, Bluesky or Threads.
- `mediaUrls` allows at most 20 items. Bluesky allows up to 4 images or 1 video.

Response 201 (or 200 when already scheduled):

```json
{ "postSubmissionId": "123e4567-e89b-12d3-a456-426614174000", "scheduledTime": "2025-03-10T15:30:00Z" }
```

`scheduledTime` is omitted when the post publishes right away. Errors: 403, 422, 429, 500. Rate limit: 30/min. Failed posts show at https://my.blotato.com/posts?status=failed, and the most common cause is bad JSON structure. Don't retry failed posts automatically, since most failures are permanent (guide, Retry Strategy).

## 4. Check a post's status

`GET /v2/posts/{postSubmissionId}`

Response 200:

```json
{
  "postSubmissionId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "published",
  "scheduledTime": "2025-03-11T15:30:00.000Z",
  "publicUrl": "https://x.com/post/12345",
  "errorMessage": "Unsupported media type"
}
```

- `status` is one of `in-progress`, `failed`, `published` or `scheduled`.
- `publicUrl` is present when published, and `errorMessage` when failed.
- Errors: 403, 404, 429, 500. Rate limit: 60/min.

Documented failure example (guide, error handling):

```json
{ "postSubmissionId": "a1b2c3d4-...", "status": "failed", "errorMessage": "Invalid account credentials" }
```

## Bluesky limits (media requirements page)

- 300 characters per post. The demo counts graphemes, which is how Bluesky counts. Blotato's Error Reference says emoji and full-width characters count as 2 toward error 20005, so Blotato's count can be higher than ours.
- Up to 4 images (1080x1080 square, 1200x627 landscape, 627x1200 portrait), or one video.

## Checked against real Blotato (2026-11-07)

Every route was called with a real key against a real Bluesky account (`adoptmeposts.bsky.social`). Where real Blotato differed from the docs or the old demo, the demo now copies real Blotato.

| Call | Real response | Was in the demo |
| --- | --- | --- |
| `GET /v2/users/me/accounts` | 200 `{ items: [{ id: "140099", platform: "bluesky", username: "adoptmeposts.bsky.social", fullname: "" }] }`: numeric-string ID, empty fullname | id `demo-bluesky-1`, fullname `Adopt Me Posts` |
| `POST /v2/media/uploads` + PUT | 201 `{ presignedUrl, publicUrl }`; publicUrl on `database.blotato.io/storage/v1/object/public/public_media/...` | Same shape |
| `POST /v2/posts` (now) | 201 `{ postSubmissionId }` (UUID) | Same |
| `POST /v2/posts` (scheduled) | 201 `{ postSubmissionId, scheduledTime: "2026-11-08T00:10:00.000Z" }` | Same |
| `GET /v2/posts/{id}` | `in-progress`, then `{ status: "published", publicUrl: "https://bsky.app/profile/adoptmeposts.bsky.social/post/..." }` about 5 s later; scheduled posts return `{ status: "scheduled", scheduledTime }` | Same |
| `GET /v2/posts/{made-up id}` | 200 `{ postSubmissionId: "<the id>", status: "in-progress" }`, also for text that isn't a UUID | 404 `Not found` |
| Wrong key | 401 `{ "message": "Unauthorized" }`, nothing else | 401 `Invalid API key` |
| Text over 300 (Blotato's count) | **422 at create time**, no post ID: `{ statusCode: 422, message: "Text length exceeds the character limit of 300 characters for platform 'bluesky'", reqId, code: 20005, action: "Shorten each post in details.overLimitPosts...", details: { platform, maxAllowed: 300, overLimitPosts: [{ index, characterCount, text }] } }` | 201, then status `failed` with `...platform bluesky (error code 20005)` |
| `POST /v2/media` with a URL that 404s | **500**, code **90000**: `Failed to read media metadata. Is the file accessible and a valid media file?` | 422, code 90009 |
| Post with a `mediaUrls` entry that 404s | 201, then status `failed`, errorMessage `Failed to fetch media URL: 404 Not Found` | `Blotato could not fetch the media URL...` |

Not reproduced for real: `Invalid account credentials` (needs a disconnected account) and code 90009. Code 90000 isn't in Blotato's docs.

Error bodies from real Blotato carry `statusCode`, `message` and `reqId`, plus `code`, `action` and `details` when there are any. The 401 is the exception: only `message`.

## Demo-mode failures

| Failure | Where it shows | Wording | Source |
| --- | --- | --- | --- |
| `invalid-key` | Any route, HTTP 401 | `{ "message": "Unauthorized" }` | Real Blotato |
| `disconnected-account` | Post status `failed` | `Invalid account credentials` | Guide, Post Failure example (not reproduced for real) |
| `bad-media-url` | `POST /v2/media` 500 with code 90000, or post status `failed` | `Failed to read media metadata. Is the file accessible and a valid media file?` / `Failed to fetch media URL: 404 Not Found` | Real Blotato |
| `too-long` | `POST /v2/posts` 422, code 20005 | `Text length exceeds the character limit of 300 characters for platform 'bluesky'`, with `action` and `details.overLimitPosts` | Real Blotato |
| Unknown post ID | Status route 200 | `{ "postSubmissionId": "<id>", "status": "in-progress" }` | Real Blotato, and the Post lifecycle page |

Demo IDs with outcome `long<N>` only exist in posts saved before too-long moved to create time; they still fail at status, with the real wording.

## Known errors

`docs/known-errors.json` lists every Blotato error this app can hit, with the documented wording, cause, fix and source page. The post doctor only cites links from that file.
