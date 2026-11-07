# Adopt Me Posts

Social posting tool for a dog rescue (made-up dogs), with a built-in post doctor. React + Vite + TypeScript on Vercel, serverless functions in `api/`, Blotato API for posting, Anthropic API for captions.

## Commit rules
- Author every commit as: `Shauna Arnold <8376913+shaunadigital@users.noreply.github.com>`
- Never add AI co-author lines (`Co-Authored-By: Claude ...`), "Generated with Claude Code", or any other AI attribution to commits, PR titles, or PR bodies.
- Commit or push only when Shauna asks.

## Secrets
- Keys live in `.env.local` (gitignored) and in Vercel env vars. Never print, log, or commit key values.
- `.env.example` lists the variable names with empty values.

## Blotato
- `docs/blotato-api-notes.md` holds the endpoints, shapes and error wording, copied from Blotato's OpenAPI spec and guide with source links. Check it (and the live spec) before touching Blotato code. Don't guess field names.
- `api/_lib/blotato.ts` is the only code that calls Blotato or reads `BLOTATO_API_KEY`. Every request and response is logged as JSON with the key hidden and signed upload URLs redacted.
- Files in `api/_lib/` are helpers, not routes (Vercel skips `_` folders). Relative imports in `api/` use `.js` extensions (Node ESM).

## API routes
| Route | Blotato call |
| --- | --- |
| `GET /api/config` | none: `{ demoMode }` |
| `GET /api/accounts?platform=` | `GET /v2/users/me/accounts` |
| `POST /api/media/upload?filename=x.jpg` (raw bytes) | `POST /v2/media/uploads`, then PUT to `presignedUrl`; returns `{ publicUrl }` |
| `POST /api/media/from-url` `{ url }` | `POST /v2/media` |
| `POST /api/posts` `{ accountId, text, mediaUrls?, scheduledTime?, additionalPosts? }` | `POST /v2/posts` (Bluesky target) |
| `GET /api/posts/:id` | `GET /v2/posts/{postSubmissionId}` |
| `POST /api/caption` `{ dogSlug, previous?, trimFrom? }` | none: Claude (`claude-sonnet-5-5`, effort low, `fallbacks: "default"`) writes a Bluesky caption under 300 characters, with no emoji and at most one hashtag. Returns `{ caption, characters, model, ms }`. Needs `ANTHROPIC_API_KEY`, which is set in Vercel Production only, so this route returns 503 under `vercel dev`. It's only called by "Rewrite with Claude", never on page load. There's a light per-IP limit of 12/min, kept in memory, so it is per instance and not shared across instances. |

Routes pass Blotato's status and body straight through, so the frontend sees real error shapes.

## Main screen
- The design spec is `~/Desktop/claudecode/jobs/blotato/design/DESIGN.md`, with `main-screen-reference.html` as the mockup. Tokens are CSS variables in `src/index.css`; components are in `src/components/`.
- Dogs: `shared/dogs.ts` (used by the client and `api/caption.ts`; keep it free of Node and browser APIs). Each dog has a hand-written `starterCaption` (under 300 characters, no emoji) that shows on load. Photos are in `public/dogs/`, with credits in `CREDITS.md`.
- Header wordmark per DESIGN.md: "adopt me" (Schibsted 800) + "/posts" (Plex Mono 500, mint), as text with aria-label "Adopt Me Posts".
- `shared/` lives outside `api/` because `vercel dev` routes every `/api/*` URL to functions, so the browser can't load source files from there.
- Posting (`App.tsx` `post()`): fetch the dog's photo from `/dogs/<slug>.jpg`, then `POST /api/media/upload`, then `POST /api/posts` with the caption and `[publicUrl]`. The button is disabled while sending, when the caption is empty or over 300, or when no account is loaded.
- Send menu: Now, Monday 9:00 AM (the next Monday, local time), or Pick a time (`datetime-local`, the viewer's zone). Scheduled times go to Blotato as ISO 8601 UTC (`toISOString()`), e.g. `2026-11-13T01:30:00.000Z`.
- "All posts" is stored in localStorage (`adopt-me-posts:posts:v1`, newest first, max 100); see `src/lib/posts.ts`. Each record carries its `trace` (caption, upload, create, result steps with state, HTTP code, timing and note) plus `rawError` for the post doctor.
- Status updates (`App.tsx`): every 3 s, poll `GET /api/posts/:id` for In progress posts (every 15 s after 20 checks), and stop at Published or Failed. Scheduled posts flip to In progress at their time. A 4xx other than 429 on a status check marks the post Failed; network errors, 429 and 5xx keep retrying.
- Post trace panel (`TracePanel.tsx`): the step timeline for the selected row, with the failing step marked. Clicking a row (or its dog-name button) selects it; on phones the page scrolls to the trace. The post doctor is still a placeholder (step 6).
- Example posts (`src/lib/examples.ts`): in demo mode only, when the browser has no saved posts, four examples are seeded: Published (Tank), Scheduled (Pip, next Monday 9 AM), In progress (Biscuit, publishes about 4 s after load) and Failed (Rocket, 312 characters). Rocket is selected. "Reset examples" replaces them and keeps the user's own posts. With a real key, examples are never seeded and any saved ones are dropped. Examples only seed after `/api/config` answers.
- Demo post IDs are encoded in `shared/demoPostIds.ts`, which the fake Blotato and the examples both use.
- Post doctor (`api/doctor.ts`, `src/components/PostDoctor.tsx`): plain code matches a failed post's error against `docs/known-errors.json` (`api/_lib/knownErrors.ts`, by Blotato error code, message pattern, then HTTP status). Claude (`claude-sonnet-5-5`, JSON schema output) writes the cause, fix, customer reply and doc links from the matched entries only. The links are limited by the schema's enum and filtered again on the server. With no match, it says so, gives no links, and lists what to check. A failed post is diagnosed once when first selected, and the result is cached on the post (`doctor`). Example posts never call it; the Rocket example's result is saved in `src/lib/examples.ts` (`ROCKET_DOCTOR`, regenerate if known-errors.json changes). "Trim and resend" (known-error ids in `TOO_LONG_IDS`) calls `/api/caption` with `trimFrom`, shows the shorter caption for approval, then posts it as a new post.
- Paste a ticket (post doctor's second mode): finds a post ID in the customer's text (`src/lib/tickets.ts`), looks it up (`GET /api/posts/:id` plus this browser's saved trace), then calls `/api/doctor` with `ticket` and `lookup`. The ticket text is fenced as customer data in the prompt, never instructions; it's also used for wording matches. With no ID, the reply asks for the post ID. The three "Try an example" tickets show results generated once with the live route and saved in `tickets.ts` (zero calls; regenerate if known-errors.json or the doctor prompt changes). Only typed or edited tickets call Claude.
- `docs/known-errors.json` is the single source for known errors: documented wording, plain-words cause and fix, exact help.blotato.com source links, and `inDocs: false` + `docsNote` for wording our demo invented. The Known errors page (`#known-errors`, `KnownErrorsPage.tsx`) renders it. Only add entries the docs support.
- The demo's too-long failure uses Blotato's documented error 20005 wording. The older invented wording stays in known-errors.json, marked not in the docs, for posts saved earlier.
- Character counting is in `shared/textCount.ts`: `countForBlotato` (emoji and full-width characters count as 2, per Blotato's Error Reference) drives the meter, the 300 limit, the caption route and the fake Blotato's too-long check. `countGraphemes` is Bluesky's own count.
- On phones the posts table stacks into rows (dog + status, then ID and error, then time), so Status shows without sideways scrolling.
- To test a failure in the UI, open the app with `?demoFail=invalid-key` (or another demo failure); the posting requests forward it as `x-demo-fail`.

## Demo mode
- When `BLOTATO_API_KEY` is empty, the app runs in demo mode: `api/_lib/demo.ts` answers instead of Blotato, and the home page shows a "Demo mode" label.
- Demo account: Bluesky `adoptmeposts.bsky.social` (id `demo-bluesky-1`). Posts are `in-progress` for 4 seconds, then `published` or `failed`. Scheduled posts stay `scheduled` until their time. Post state is stateless, encoded in the ID.
- Force a failure with `?demoFail=` or an `x-demo-fail` header: `invalid-key`, `disconnected-account`, `bad-media-url`, `too-long`. Text over 300 graphemes, unknown account IDs and unfetchable media URLs also fail on their own. This is ignored when a real key is set.

## Local dev and tests
- `npm run dev` runs the front end only (Vite). `/api` routes need `vercel dev --listen 3000`.
- `npm run test:demo` calls every route in demo mode (default `http://localhost:3000`; set `BASE_URL` to test a deploy).
- Run `npm run build` before pushing. It typechecks `api/` too (`tsconfig.api.json`).
