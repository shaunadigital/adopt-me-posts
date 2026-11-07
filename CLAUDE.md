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

Routes pass Blotato's status and body straight through, so the frontend sees real error shapes.

| `POST /api/caption` `{ dogSlug, previous? }` | none: Claude (`claude-sonnet-5-5`, effort low, `fallbacks: "default"`) writes a Bluesky caption under 300 characters, with no emoji and at most one hashtag. Returns `{ caption, characters, model, ms }`. Needs `ANTHROPIC_API_KEY`, which is set in Vercel Production only, so this route returns 503 under `vercel dev`. It's only called by "Rewrite with Claude", never on page load. There's a light per-IP limit of 12/min, kept in memory, so it is per instance and not shared across instances. |

## Main screen
- The design spec is `~/Desktop/claudecode/jobs/blotato/design/DESIGN.md`, with `main-screen-reference.html` as the mockup. Tokens are CSS variables in `src/index.css`; components are in `src/components/`.
- Dogs: `shared/dogs.ts` (used by the client and `api/caption.ts`; keep it free of Node and browser APIs). Each dog has a hand-written `starterCaption` (under 300 characters, no emoji) that shows on load. Photos are in `public/dogs/`, with credits in `CREDITS.md`.
- Header wordmark per DESIGN.md: "adopt me" (Schibsted 800) + "/posts" (Plex Mono 500, mint), as text with aria-label "Adopt Me Posts".
- `shared/` lives outside `api/` because `vercel dev` routes every `/api/*` URL to functions, so the browser can't load source files from there.
- The "All posts" and "Post trace" panels are empty states until posting is wired up. The "Post {dog}" button is disabled for now.

## Demo mode
- When `BLOTATO_API_KEY` is empty, the app runs in demo mode: `api/_lib/demo.ts` answers instead of Blotato, and the home page shows a "Demo mode" label.
- Demo account: Bluesky `adoptmeposts.bsky.social` (id `demo-bluesky-1`). Posts are `in-progress` for 4 seconds, then `published` or `failed`. Scheduled posts stay `scheduled` until their time. Post state is stateless, encoded in the ID.
- Force a failure with `?demoFail=` or an `x-demo-fail` header: `invalid-key`, `disconnected-account`, `bad-media-url`, `too-long`. Text over 300 graphemes, unknown account IDs and unfetchable media URLs also fail on their own. This is ignored when a real key is set.

## Local dev and tests
- `npm run dev` runs the front end only (Vite). `/api` routes need `vercel dev --listen 3000`.
- `npm run test:demo` calls every route in demo mode (default `http://localhost:3000`; set `BASE_URL` to test a deploy).
- Run `npm run build` before pushing. It typechecks `api/` too (`tsconfig.api.json`).
