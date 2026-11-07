// POST /api/doctor: diagnose a failed post.
// Body: { dogName, caption, failedStep, httpStatus, error, rawError, trace }
// 1. Plain code matches the error against docs/known-errors.json.
// 2. Claude (claude-sonnet-5-5) writes cause, fix and a customer reply from the matched entries only.
//    Its doc links are limited by the JSON schema to the matched entries' URLs, and checked again here.
// Response: { matched, entries, cause, fix, reply, sources, checks, model, generatedAt }
import Anthropic from '@anthropic-ai/sdk'
import { evidenceFrom, matchKnownErrors, type KnownError, type KnownErrorSource } from './_lib/knownErrors.js'
import { json, readJson } from './_lib/http.js'
import { rateLimited } from './_lib/rateLimit.js'

const MODEL = 'claude-sonnet-5-5'

const SYSTEM = `You are the post doctor in a social posting tool built on the Blotato API. A post to Bluesky failed. You explain it to the person running the tool, who supports the customer (a small dog rescue) that made the post.

You get the failed post's trace, its raw error, and the entries from a list of known Blotato errors that matched it. Rules:
- Base the cause and fix only on the matched entries and the trace. Don't add causes, limits, settings, menu names or numbers that aren't in them.
- If an entry has a docsNote, respect it (for example, if its wording isn't in Blotato's docs, don't say Blotato documents it).
- If no entries matched, say plainly that this error isn't in the known-errors list, give no doc links, and list 2 to 4 concrete things to check from the trace and raw error.
- cause: one or two plain sentences. fix: one to three plain sentences, the specific action.
- reply: a warm, short message (under 110 words) to the customer who made the post. Plain words, no jargon or error codes, no blame, say what happened and what to do or what will happen next. Don't promise anything you can't see in the trace. No links in the reply. Sign off as "The Adopt Me Posts team".
- sourceUrls: only URLs from the matched entries' sources that you actually relied on.
- No emoji.`

function schemaFor(allowedUrls: string[]) {
  return {
    type: 'object',
    properties: {
      cause: { type: 'string' },
      fix: { type: 'string' },
      reply: { type: 'string' },
      // With no matches there are no allowed links; anything returned is dropped below.
      sourceUrls: allowedUrls.length
        ? { type: 'array', items: { type: 'string', enum: allowedUrls } }
        : { type: 'array', items: { type: 'string' } },
      checks: { type: 'array', items: { type: 'string' } },
    },
    required: ['cause', 'fix', 'reply', 'sourceUrls', 'checks'],
    additionalProperties: false,
  }
}

const clip = (v: unknown, n: number) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? null)
  return s.length > n ? `${s.slice(0, n)}…` : s
}

let client: Anthropic | null = null

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return json(503, { message: 'The post doctor is not set up: ANTHROPIC_API_KEY is missing on the server.' })
  }
  if (rateLimited(req, 'doctor', 10)) return json(429, { message: 'Too many diagnoses in a minute. Wait a moment and try again.' })

  const body = await readJson(req)
  if (body instanceof Response) return body
  const { dogName, caption, failedStep, httpStatus, error, rawError, trace } = body
  if (!Array.isArray(trace)) return json(400, { message: 'Send the failed post\'s "trace".' })

  const evidence = evidenceFrom(rawError, httpStatus, [error])
  const entries = matchKnownErrors(evidence)
  const allowed = [...new Set(entries.flatMap((e) => e.sources.map((s) => s.url)))]

  const matchedText = entries.length
    ? entries
        .map((e: KnownError) =>
          JSON.stringify({
            id: e.id,
            title: e.title,
            wording: e.wording,
            stage: e.stage,
            cause: e.cause,
            fix: e.fix,
            sources: e.sources,
            inDocs: e.inDocs,
            docsNote: e.docsNote,
          }),
        )
        .join('\n')
    : 'None. This error is not in the known-errors list.'

  const prompt = `Failed post
Dog: ${clip(dogName, 40)}
Caption (${typeof caption === 'string' ? [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(caption)].length : '?'} characters): ${clip(caption, 700)}
Failed step: ${clip(failedStep, 20)}
HTTP status: ${clip(httpStatus, 10)}
Error shown to the user: ${clip(error, 500)}
Raw error response: ${clip(rawError, 1500)}
Trace: ${clip(trace, 2500)}

Matched known-error entries:
${matchedText}`

  client ??= new Anthropic()
  const started = Date.now()
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: schemaFor(allowed) } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    if (res.stop_reason === 'refusal') {
      return json(502, { message: 'Claude declined to diagnose this post. Use the Known errors page instead.' })
    }
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    let out: { cause: string; fix: string; reply: string; sourceUrls: string[]; checks: string[] }
    try {
      out = JSON.parse(text)
    } catch {
      return json(502, { message: 'Claude returned an answer the app could not read. Try again.' })
    }

    // Never pass on a link that isn't in a matched entry, whatever the model returned.
    const byUrl = new Map<string, KnownErrorSource>()
    for (const e of entries) for (const s of e.sources) if (!byUrl.has(s.url)) byUrl.set(s.url, s)
    let sources = [...new Set(out.sourceUrls)].filter((u) => byUrl.has(u)).map((u) => byUrl.get(u)!)
    if (entries.length && sources.length === 0) sources = entries[0].sources

    console.log(
      JSON.stringify({
        doctor: 'done',
        matched: entries.map((e) => e.id),
        sources: sources.length,
        ms: Date.now() - started,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      }),
    )
    return json(200, {
      matched: entries.length > 0,
      entries: entries.map((e) => ({ id: e.id, title: e.title, inDocs: e.inDocs, docsNote: e.docsNote })),
      cause: out.cause.trim(),
      fix: out.fix.trim(),
      reply: out.reply.trim(),
      sources,
      checks: entries.length ? [] : out.checks.slice(0, 4),
      model: MODEL,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(429, { message: 'Claude is rate limited right now. Try again in a minute.' })
    if (e instanceof Anthropic.APIError) {
      console.error(`doctor: Anthropic API error ${e.status}: ${e.message}`)
      return json(502, { message: `Claude API error ${e.status ?? ''}. Try again.`.replace('  ', ' ') })
    }
    console.error('doctor: unexpected error', e)
    return json(500, { message: 'Something went wrong diagnosing the post.' })
  }
}
