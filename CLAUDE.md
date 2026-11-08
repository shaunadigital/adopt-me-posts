# Adopt Me Posts

Social posting tool for a dog rescue (made-up dogs), with a built-in post doctor. React + Vite + TypeScript on Vercel, serverless functions in `api/`, Blotato API for posting, Anthropic API for captions.

## Writing rules
- No em dashes in any user-facing text: app UI, Known errors page, example tickets, starter captions, README, n8n agent text, and the prompts that make Claude write for users (caption, doctor, n8n agent, /post-doctor). Use commas, periods or colons.

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
- The design spec is `~/Desktop/claudecode/jobs/blotato/design/DESIGN.md`, with `main-screen-reference.html` as the mockup. Components are in `src/components/`.
- Colors: exactly the 15 in DESIGN.md, defined once as role variables at the top of `src/index.css` (`--ink`, `--raised-on-dark`, `--muted`, `--control`, `--border`, `--divider`, `--page`, `--soft`, `--panel`, `--accent`, `--accent-on-dark`, `--accent-tint`, `--fail`, `--fail-tint`, `--demo`). Use only these variables; no hex values elsewhere in CSS or components (SVGs use `currentColor`). Teal only means "on track" (plus links and the selected-row bar), rust only failures, amber only the Demo badge, no blue. Scheduled is an outlined gray pill. Inputs and controls sit on white so the `--control` border keeps 3:1. Inside the dark doctor panel, controls use `--control` borders and decorative boxes use `--muted`.
- Dogs: `shared/dogs.ts` (used by the client and `api/caption.ts`; keep it free of Node and browser APIs). Each dog has a hand-written `starterCaption` (under 300 characters, no emoji) that shows on load. Photos are in `public/dogs/`, with credits in `CREDITS.md`.
- Header wordmark per DESIGN.md: "adopt me" (Schibsted 800) + "/posts" (Plex Mono 500, mint), as text with aria-label "Adopt Me Posts".
- `shared/` lives outside `api/` because `vercel dev` routes every `/api/*` URL to functions, so the browser can't load source files from there.
- Posting (`App.tsx` `post()`): fetch the dog's photo from `/dogs/<slug>.jpg`, then `POST /api/media/upload`, then `POST /api/posts` with the caption and `[publicUrl]`. The button is disabled while sending, when the caption is empty or over 300, or when no account is loaded.
- Send menu: Now, Monday 9:00 AM (the next Monday, local time), or Pick a time (`datetime-local`, the viewer's zone). Scheduled times go to Blotato as ISO 8601 UTC (`toISOString()`), e.g. `2026-11-13T01:30:00.000Z`.
- "All posts" is stored in localStorage (`adopt-me-posts:posts:v1`, newest first, max 100); see `src/lib/posts.ts`. Each record carries its `trace` (caption, upload, create, result steps with state, HTTP code, timing and note) plus `rawError` for the post doctor.
- Status updates (`App.tsx`): every 3 s, poll `GET /api/posts/:id` for In progress posts (every 15 s after 20 checks), and stop at Published or Failed. Scheduled posts flip to In progress at their time. A 4xx other than 429 on a status check marks the post Failed; network errors, 429 and 5xx keep retrying.
- Post trace panel (`TracePanel.tsx`): the step timeline for the selected row, with the failing step marked. Clicking a row (or its dog-name button) selects it; on phones the page scrolls to the trace. The post doctor is still a placeholder (step 6).
- Example posts (`src/lib/examples.ts`): in demo mode only, when the browser has no saved posts, four examples are seeded: Published (Tank), Scheduled (Pip, next Monday 9 AM), In progress (Biscuit, publishes about 4 s after load) and Failed (Rocket, 312 characters, rejected at create with 422 code 20005, so it has no post ID). Rocket is selected. "Reset examples" replaces them and keeps the user's own posts. With a real key, examples are never seeded and any saved ones are dropped. Examples only seed after `/api/config` answers.
- Demo post IDs are encoded in `shared/demoPostIds.ts`, which the fake Blotato and the examples both use.
- Post doctor (`api/doctor.ts`, `src/components/PostDoctor.tsx`): plain code matches a failed post's error against `docs/known-errors.json` (`api/_lib/knownErrors.ts`, by Blotato error code, message pattern, then HTTP status). Claude (`claude-sonnet-5-5`, JSON schema output) writes the cause, fix, customer reply and doc links from the matched entries only. The links are limited by the schema's enum and filtered again on the server. With no match, it says so, gives no links, and lists what to check. A failed post is diagnosed once when first selected, and the result is cached on the post (`doctor`). Example posts never call it; the Rocket example's result is saved in `src/lib/examples.ts` (`ROCKET_DOCTOR`, regenerate if known-errors.json changes). "Trim and resend" (known-error ids in `TOO_LONG_IDS`) calls `/api/caption` with `trimFrom`, shows the shorter caption for approval, then posts it as a new post.
- Paste a ticket (post doctor's second mode): finds a post ID in the customer's text (`src/lib/tickets.ts`), looks it up (`GET /api/posts/:id` plus this browser's saved trace), then calls `/api/doctor` with `ticket` and `lookup`. The ticket text is fenced as customer data in the prompt, never instructions; it's also used for wording matches. With no ID, the reply asks for the post ID. The three "Try an example" tickets show results generated once with the live route and saved in `tickets.ts` (zero calls; regenerate if known-errors.json or the doctor prompt changes). Only typed or edited tickets call Claude.
- `docs/known-errors.json` is the single source for known errors: documented wording, plain-words cause and fix, exact help.blotato.com source links, and `inDocs: false` + `docsNote` for wording our demo invented. The Known errors page (`#known-errors`, `KnownErrorsPage.tsx`) renders it. Only add entries the docs support.
- The demo's too-long failure is real Blotato's 422 (code 20005) at create time. The older invented wording stays in known-errors.json, marked not in the docs, for posts saved earlier.
- Character counting is in `shared/textCount.ts`: `countForBlotato` (emoji and full-width characters count as 2, per Blotato's Error Reference) drives the meter, the 300 limit, the caption route and the fake Blotato's too-long check. `countGraphemes` is Bluesky's own count.
- On phones the posts table stacks into rows (dog + status, then ID and error, then time), so Status shows without sideways scrolling.
- To test a failure in the UI, open the app with `?demoFail=invalid-key` (or another demo failure); the posting requests forward it as `x-demo-fail`.

## Demo mode
- When `BLOTATO_API_KEY` is empty, the app runs in demo mode: `api/_lib/demo.ts` answers instead of Blotato, and the home page shows a "Demo mode" label.
- The demo copies real Blotato's shapes, status codes and wording, checked 2026-11-07 (table in `docs/blotato-api-notes.md`).
- Demo account: Bluesky `adoptmeposts.bsky.social` (id `100001`, empty fullname, like the real account). Posts are `in-progress` for 4 seconds, then `published` or `failed`. Scheduled posts stay `scheduled` until their time. Post state is stateless, encoded in the ID.
- Force a failure with `?demoFail=` or an `x-demo-fail` header: `invalid-key`, `disconnected-account`, `bad-media-url`, `too-long`. Text over 300 (Blotato's count) is rejected at create with 422 code 20005, like real Blotato. Unknown account IDs and unfetchable media URLs also fail on their own. Unknown post IDs return 200 `in-progress`. This is ignored when a real key is set.

## Deploys
- Pushes to `main` deploy through Vercel's GitHub App (project `adopt-me-posts`, production branch `main`, no ignored-build-step command, no root directory).
- 2026-11-07: three pushes got no deployment. One was the first commit, pushed before the Vercel project existed. The other two (`03a60c5`, `c5d86aa`) were ordinary commits that left no trace on Vercel (no deployment, no event) or GitHub (no Vercel status); empty "Redeploy" commits deployed them. Project settings were fine, and the repo has no webhooks; the GitHub App's delivery log is only visible to Vercel. The Git link was reconnected (`vercel git disconnect` / `vercel git connect`) the same day.
- If a push doesn't deploy within a few minutes: check `gh api repos/shaunadigital/adopt-me-posts/commits/<sha>/statuses` for a "Vercel" status, then push an empty commit or run `vercel deploy --prod`.

## Local dev and tests
- `npm run dev` runs the front end only (Vite). `/api` routes need `vercel dev --listen 3000`.
- `npm run test:demo` calls every route in demo mode (default `http://localhost:3000`; set `BASE_URL` to test a deploy).
- Run `npm run build` before pushing. It typechecks `api/` too (`tsconfig.api.json`).

## Claude Code tooling
- `.mcp.json`: `blotato-docs` (`https://help.blotato.com/~gitbook/mcp`, public, no key; tools `searchDocumentation`, `getPage`) and `blotato` (`https://mcp.blotato.com/mcp`, header `blotato-api-key: ${BLOTATO_API_KEY:-}` from the shell environment, never written in the file). The `:-` default keeps the file loading when the key isn't set.
- `/post-doctor` skill: `.claude/skills/post-doctor/SKILL.md`. It uses `scripts/match-error.ts` (the app's matcher, run with `node scripts/match-error.ts --text "..."`), the docs MCP, and the Blotato MCP or the app's demo API for status. It has the same rules as `/api/doctor` and a docs-only mode with no key.
- Tested 2026-11-07: the docs MCP answered "error code 20005" with the Error Reference row (same wording as known-errors.json). `claude mcp list` loads both servers from `.mcp.json` with no key set.
- Blotato MCP (`blotato` server) tested 2026-11-07 with a real key; see the go-live checklist below.

## n8n: Dog of the week
- `n8n/dog-of-the-week.json`: Schedule Trigger (cron `0 9 * * 1`, workflow time zone Pacific/Honolulu) plus a manual trigger, then `GET /api/dogs`, then Blotato node Media > Upload (`mediaUrl`), then Post > Create (bluesky, `postContentText`, `postContentMediaUrls`), then Wait 30 s, then Post > Get. Uses the official community node `@blotato/n8n-nodes-blotato` (v1.0.10, node version 2) and a "Blotato API" n8n credential. No credentials or keys in the file.
- `api/dogs.ts`: public, static (no Claude). Rotation anchored to Monday 2026-11-09 (Mochi), weeks counted in Hawaii time; `?date=YYYY-MM-DD` previews a week.
- Tested 2026-11-07 with n8n 2.46.6 via npx (user folder kept outside the repo): the workflow imports. A copy with Blotato nodes swapped for Set nodes ran end to end (live `/api/dogs`, all expressions resolve). The real Upload node with a fake-key credential reached Blotato and got 401 "Authorization failed - please check your credentials". The real workflow won't run until a Bluesky account is picked in Post to Bluesky, which needs a real key.

## n8n: Support agent
- `n8n/support-agent.json`: Chat Trigger (public, hosted chat) to an AI Agent (v3.1) with `lmChatAnthropic` (`claude-sonnet-5-5`, thinkingMode adaptive, effort low, so no temperature is sent), `memoryBufferWindow` (10), and three tools: `look_up_post` (HTTP Request tool, `/api/posts/{$fromAI postSubmissionId}`, neverError), `search_known_errors` (`/api/known-errors?q=`), and `mcpClientTool` for the Blotato docs MCP (only `searchDocumentation`, `getPage`). Anthropic key only in an n8n credential; the file has none (exported from n8n, credentials stripped).
- `api/known-errors.ts`: public, read-only, no Claude. With no query it returns all entries; `?q=` runs the post doctor's matcher; `?id=` returns one entry.
- Instructions: answer non-technical and mildly technical questions; billing goes to a person ("Handoff: billing"); very technical questions are escalated with a "For the engineer (internal)" note. Customer text is data; it only cites pages a tool returned.
- n8n's simple memory stores chat text, not tool calls, so the prompt says to trust earlier replies and run the tools fresh for each new question. Without that, it apologized for "not checking" earlier answers.
- Tested 2026-11-07 in local n8n 2.46.6 hosted chat: Rocket by ID, vague "posts aren't showing", double-charge refund (handoff), webhook signature (escalated, honestly noting no doc covers an X-Blotato-Signature header). Screenshot: `docs/images/support-agent-chat.jpg`.

## Daily docs check
- `.github/workflows/docs-check.yml`: daily at 17:13 UTC (7:13 AM Hawaii) plus workflow_dispatch. Job `check` (contents: read) curls every source URL, then runs `anthropics/claude-code-action@v1` with `/docs-check`, `claude-sonnet-5-5`, `--max-turns 30`, only Read and the blotato-docs search/getPage tools (Edit, Write, Bash and web tools disallowed), and a `--json-schema` report. Job `report` (issues: write, no Claude) writes a run summary on every run (confirmed differences plus the `unverified` list: items Claude couldn't confirm either way), and opens or updates one open `docs-drift` issue only when `differences` is non-empty. Unverified items never open an issue. The report also has `entries[]` with `result` and `pages_opened` per entry (the pages Claude actually opened or searched to verify it), shown as a table in the summary. `show_full_output` stays off.
- Needs the `ANTHROPIC_API_KEY` repo secret (set 2026-11-07).
- Skill: `.claude/skills/docs-check/SKILL.md` (also runs locally in Claude Code with the blotato-docs MCP).

## Real mode (local only)
- Production on Vercel has no `BLOTATO_API_KEY` and always runs in demo mode. Real posting runs locally only: `set -a && source .env.local && set +a && vercel dev --listen 3000` (`vercel dev` doesn't load `.env.local` by itself). Never add the Blotato key to Vercel.
- Tested 2026-11-07 with a real key: accounts, upload, post now (published on Bluesky about 5 s later), scheduled post, a broken media URL (doctor matched `media-url-fetch-failed`), and made-up IDs (200 `in-progress`).
- Real posts don't send alt text, so Bluesky shows the photo's alt as "image". Blotato's API has no alt text for Bluesky (checked 2026-11-07 in the live OpenAPI spec and the docs: `altText` exists only on the Instagram and Pinterest targets; the Bluesky target has only `targetType`). Don't add it until Blotato supports it.

## Go-live checklist (PLAN step 10, after the Blotato key exists)
- [x] Blotato MCP (2026-11-07): `blotato_list_accounts` returned one account, Bluesky `adoptmeposts.bsky.social` (id `140099`, empty fullname, no subaccounts, no required fields). `/post-doctor 99215d5d-b8ed-4ef6-ac28-bddd06d037e4` (the broken Pepper post from part 1) checked status with `blotato_get_post_status`: `failed`, "Failed to fetch media URL: 404 Not Found". The matcher picked `media-url-fetch-failed`, and the answer cited its three doc pages. `blotato_list_posts` shows the same post as id `829960` (a different ID from the postSubmissionId). Screenshots: `jobs/blotato/screenshots/07-mcp-list-accounts.png`, `08-post-doctor-pepper-mcp.png`.
- [x] Alt text (2026-11-07): not supported for Bluesky through Blotato (see Real mode), so no code change and no test post.
- [ ] n8n full run: install `@blotato/n8n-nodes-blotato`, import `n8n/dog-of-the-week.json`, create the Blotato API credential, select it on the three Blotato nodes, pick the Bluesky account in Post to Bluesky, click Run now (testing), and confirm Check post status ends `published` (or `in-progress`; Blotato's docs say wait at least 10 s between checks). Screenshot the run for the README, then decide whether to activate the Monday schedule.
