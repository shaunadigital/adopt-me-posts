# Adopt Me Posts

Social posting tool for a dog rescue (made-up dogs), with a built-in post doctor. React + Vite + TypeScript on Vercel, serverless functions in `api/`, Blotato API for posting, Anthropic API for captions.

## Commit rules
- Author every commit as: `Shauna Arnold <8376913+shaunadigital@users.noreply.github.com>`
- Never add AI co-author lines (`Co-Authored-By: Claude ...`), "Generated with Claude Code", or any other AI attribution to commits, PR titles, or PR bodies.
- Commit or push only when Shauna asks.

## Secrets
- Keys live in `.env.local` (gitignored) and in Vercel env vars. Never print, log, or commit key values.
- `.env.example` lists the variable names with empty values.

## Demo mode
- When `BLOTATO_API_KEY` is empty, the app runs in demo mode: Blotato calls return fake responses and the home page shows a "Demo mode" label.
- `api/config.ts` reports `{ demoMode }` to the client. It never returns key values.

## Local dev
- `npm run dev` runs the front end only (Vite). `/api` routes need `vercel dev`.
- Run `npm run build` before pushing.
