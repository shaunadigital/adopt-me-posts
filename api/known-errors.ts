// GET /api/known-errors: the known-errors list (docs/known-errors.json), public and read-only. No Claude.
//   ?q=<error text or customer wording>  the entries the post doctor's matcher picks for that text
//   ?id=<entry id>                       one entry
// Used by the n8n "Support agent" (n8n/support-agent.json) as its "search known errors" tool.
import data from '../docs/known-errors.json' with { type: 'json' }
import { KNOWN_ERRORS, evidenceFrom, matchKnownErrors } from './_lib/knownErrors.js'
import { json } from './_lib/http.js'

const headers = { 'Cache-Control': 'public, max-age=300' }

export function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim().slice(0, 1000)
  const id = url.searchParams.get('id')?.trim()

  if (id) {
    const entry = KNOWN_ERRORS.find((e) => e.id === id)
    return entry ? Response.json({ entry }, { headers }) : json(404, { message: `No known-errors entry with id "${id}".` })
  }
  if (q) {
    const matched = matchKnownErrors(evidenceFrom(null, undefined, [q]))
    return Response.json(
      {
        query: q,
        matched,
        note: matched.length
          ? 'Entries matched by the same rules the post doctor uses. Cite only their sources.'
          : 'Nothing in the known-errors list matches this text.',
      },
      { headers },
    )
  }
  return Response.json({ collected: data.collected, count: KNOWN_ERRORS.length, entries: KNOWN_ERRORS }, { headers })
}
