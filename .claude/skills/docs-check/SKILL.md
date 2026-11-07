---
name: docs-check
description: Compare docs/known-errors.json with Blotato's live documentation (Error Reference and each entry's source pages) using the blotato-docs MCP server, and report only real differences in wording, error codes, or source pages. Use when asked to check the known-errors list for drift, or by the daily docs-check GitHub Action.
argument-hint: "[optional: path to a source-page status file]"
allowed-tools: Read, mcp__blotato-docs__searchDocumentation, mcp__blotato-docs__getPage
---

# /docs-check

Checks that `docs/known-errors.json` still matches what Blotato's help docs say. The post doctor (`api/doctor.ts`) and `/post-doctor` only cite this list, so drift here means they could quote wording or link pages that no longer exist.

**Read-only.** Never edit, create or delete files, run shell commands, or open issues. Report only.

## Inputs

- `docs/known-errors.json`: read it first. Each entry has `id`, `wording` (strings quoted from the docs, with `N`, `X` or `[ID]` standing in for values), `match.codes` (Blotato error codes), `sources` (title + URL), `inDocs`, and `docsNote`.
- Optional source-page status file (`$ARGUMENTS`, for example `/tmp/source-status.json`): `[{ "url": ..., "status": 200 }]`, already fetched by the workflow. If given, use it for step 2 instead of opening every page.

## What to check

1. **Skip what isn't a docs claim.** Entries with `inDocs: false` hold our own demo wording on purpose: check only that their `sources` still exist. Generic labels that aren't quoted errors (for example "Validation error", "Not found", "Subscription-related 403", "status: scheduled", or a symptom description) aren't wording checks.

2. **Source pages exist.** For every distinct URL in `sources`: from the status file if given, otherwise with `getPage`. A non-200 status or a missing page is a difference (`source_missing`). If `searchDocumentation` shows the same content now lives at another help.blotato.com URL, report `source_moved` with the new URL.

3. **Quoted wording still appears.** For each `wording` string of an `inDocs: true` entry, call `searchDocumentation` with the wording, with placeholders removed. Run several searches in parallel in one turn to save turns. It still matches if the docs show the same sentence, with real values in place of `N`/`X`/`[ID]`, and minor punctuation differences don't count. If the search doesn't surface it, open the entry's source page with `getPage` before concluding anything (the Error Reference is long, so open it at most once per run).
   - Found with different wording: `wording_changed` (quote both).
   - Not found on its source page or anywhere in search: `wording_missing`.

4. **Error codes.** For entries with `match.codes`, confirm the docs still give that code for that error. A different code is `code_changed`.

5. **Explanations that now contradict ours.** Only when the docs' explanation directly contradicts our `cause` or `fix` (for example a new limit, a removed step, a different count rule): `explanation_changed`. Different phrasing of the same meaning is not a difference.

## Rules for reporting

- `differences`: only real differences you confirmed in the docs this run. When unsure, open the page; if still unsure, it is not a difference.
- `unverified`: everything you checked for but could not confirm either way this run, with the reason. For example: a wording you didn't find in search and whose source page you didn't open (or opened without finding it, but couldn't rule out a rewording), or a code you couldn't locate. List each item once (entry id plus the wording, code or URL). Leave it empty only if every check was confirmed. These are shown on every run but never open an issue, so be honest here rather than guessing.
- Quote the docs' exact current text in `docs`, and our text in `ours`.
- Only cite `https://help.blotato.com/...` URLs that the tools returned this run.
- Never put customer data or API keys in searches (there are none in this task).

## Output

When run by the GitHub Action, return the structured output it asks for. When run interactively, reply with:

```
Checked <n> entries and <m> source pages against Blotato's docs (<date>).

No differences.            ← or, for each difference:
- <entryId> · <kind>
  Ours: "<our text>"
  Docs: "<their current text>"  (<url>)
  Suggested change: <one line>

Unverified:                ← or "Everything was confirmed."
- <entryId> · "<wording, code or URL>": <why it couldn't be confirmed>
```
