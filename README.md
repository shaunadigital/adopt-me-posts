# Adopt Me Posts

> Draft README. The full version (overview, setup, "What I found in the docs") comes in a later step.

A sample social posting tool for a small dog rescue, built on the [Blotato API](https://help.blotato.com). It writes Bluesky captions with Claude, uploads a dog's photo, posts or schedules through Blotato, follows each post to its result, and has a built-in post doctor that explains failures in plain words with links to Blotato's docs.

Live: https://adopt-me-posts.vercel.app (demo mode: a fake Blotato answers until a real API key is set).

## n8n workflow: Dog of the week

`n8n/dog-of-the-week.json` posts one dog to Bluesky every Monday at 9:00 AM Hawaii time, rotating through the six in order (Mochi, Biscuit, Rocket, Pepper, Pip, Tank, then back to Mochi):

1. **Get dog of the week:** `GET https://adopt-me-posts.vercel.app/api/dogs` returns this week's dog with its starter caption and public photo URL. It's static data with no Claude call, and `?date=YYYY-MM-DD` previews any week.
2. **Upload photo to Blotato:** Media > Upload from the photo URL.
3. **Post to Bluesky:** Post > Create with the caption and the uploaded media URL.
4. **Wait 30 seconds**, then **Check post status:** Post > Get, once.

It uses Blotato's official n8n node ([`@blotato/n8n-nodes-blotato`](https://github.com/Blotato-Inc/n8n-nodes-blotato), per [Blotato's n8n docs](https://help.blotato.com/integrations-and-automation-templates/n8n/n8n-blotato-node)). The API key lives only in an n8n credential, never in the workflow file.

**Import it:**

1. Install the node: in n8n, Settings > Community Nodes > Install > `@blotato/n8n-nodes-blotato` (n8n Cloud: search "Blotato" in the node panel).
2. Import the workflow: Workflows > Import from File > `n8n/dog-of-the-week.json`, or `npx n8n import:workflow --input=n8n/dog-of-the-week.json`.
3. Create a **Blotato API** credential with your key (keep the server as `https://backend.blotato.com`), and select it on the three Blotato nodes.
4. In **Post to Bluesky**, pick the Bluesky account from the list.
5. Click **Run now (testing)** to try it once, then activate the workflow so the Monday schedule runs. The workflow's time zone is set to Pacific/Honolulu.

## Daily docs check

The post doctor only cites entries in `docs/known-errors.json`, so that list has to keep matching Blotato's docs. A scheduled agent checks it every day.

- **When:** daily at 7:13 AM Hawaii time, plus a **Run workflow** button (Actions > Daily docs check). See `.github/workflows/docs-check.yml`.
- **What:** Claude Code (`claude-sonnet-5-5`, at most 20 turns), run by [Anthropic's Claude Code GitHub Action](https://github.com/anthropics/claude-code-action), uses the `/docs-check` skill (`.claude/skills/docs-check/SKILL.md`) and Blotato's public docs MCP server. It compares every entry's quoted wording, error codes and source pages with Blotato's current Error Reference and help pages. A shell step checks that each source page still loads before Claude starts, so it doesn't spend turns on that.
- **Output:** if anything differs, one issue labeled `docs-drift` is opened, or updated if one is already open, listing ours vs. the docs' current text with the page link. If nothing changed, nothing is opened.
- **Why it's safe to leave running:** Claude's job gets a read-only token, can only read files and use the docs search and page tools, and returns a fixed-shape report. A separate plain script (no Claude) writes the issue. Nothing edits files or pushes code.
- **Setup:** add `ANTHROPIC_API_KEY` as a repo secret (`gh secret set ANTHROPIC_API_KEY`).

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
