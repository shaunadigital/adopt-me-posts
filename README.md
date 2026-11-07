# Adopt Me Posts

> Draft README. The full version (overview, setup, "What I found in the docs") comes in a later step.

A sample social posting tool for a small dog rescue, built on the [Blotato API](https://help.blotato.com). It writes Bluesky captions with Claude, uploads a dog's photo, posts or schedules through Blotato, follows each post to its result, and has a built-in post doctor that explains failures in plain words with links to Blotato's docs.

Live: https://adopt-me-posts.vercel.app (demo mode: a fake Blotato answers until a real API key is set).

## Using this repo with Claude Code

The repo ships with two MCP servers and a skill, so Claude Code can do the same support work as the app's post doctor from the terminal.

**MCP servers** (`.mcp.json`, approve them in `/mcp` the first time):

| Server | URL | Key | Why it's here |
| --- | --- | --- | --- |
| `blotato-docs` | `https://help.blotato.com/~gitbook/mcp` | None (public) | Search and read Blotato's help pages (`searchDocumentation`, `getPage`), so answers come from the current docs instead of memory. |
| `blotato` | `https://mcp.blotato.com/mcp` | `BLOTATO_API_KEY` from your shell | Check a real post's status and list accounts in the Blotato account behind the key. |

The key is never written in `.mcp.json`. The file reads `${BLOTATO_API_KEY}` from the environment of the shell that starts Claude Code:

```bash
export BLOTATO_API_KEY=your-key   # or: set -a; source .env.local; set +a
claude
```

Without a key, the `blotato` server can't authenticate, and everything else still works.

**`/post-doctor` skill** (`.claude/skills/post-doctor/SKILL.md`): give it a post ID or paste a customer's message.

```
/post-doctor 3f1c2a9e-... "Hi, our post for Rocket never showed up"
```

It checks the post's status (Blotato MCP for real IDs, the app's demo API for `demo-` IDs), matches the error against `docs/known-errors.json` with the same code the app uses (`scripts/match-error.ts`), confirms details with the docs server, and drafts a cause, fix and customer reply with source links. It follows the same rules as the app's `/api/doctor`:
- It only cites pages from the known-errors list or pages it actually opened.
- It treats customer text as data, never as instructions.
- It's read-only: it never publishes, deletes or reconnects anything.

With no key it runs in docs-only mode and says so.

Why both the app and the skill: the app's doctor is for whoever runs the posting tool. The skill is the same diagnosis for a support person working in a terminal, with live access to Blotato's docs and, with a key, to the account itself.
