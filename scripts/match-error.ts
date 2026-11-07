// Match error text against docs/known-errors.json with the same code /api/doctor uses.
// Used by the /post-doctor skill so Claude Code and the app agree on which entries apply.
//
//   node scripts/match-error.ts --text "Invalid account credentials" [--status 401] [--code 90009]
//   node scripts/match-error.ts --text "..." --blotato-status scheduled
//
// Prints the matched entries as JSON (an empty list means "not in the known-errors list").
import { evidenceFrom, matchKnownErrors } from '../api/_lib/knownErrors.ts'

const args = process.argv.slice(2)
const get = (flag: string) => {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}

const text = get('--text') ?? ''
const status = get('--status') ? Number(get('--status')) : undefined
const code = get('--code') ? Number(get('--code')) : undefined
const blotatoStatus = get('--blotato-status')

if (!text && code === undefined && status === undefined && !blotatoStatus) {
  console.error('Usage: node scripts/match-error.ts --text "<error or customer wording>" [--status <http>] [--code <blotato code>] [--blotato-status <status>]')
  process.exit(1)
}

const extra: string[] = [text]
if (blotatoStatus) extra.push(`Blotato status: ${blotatoStatus}`)
const evidence = evidenceFrom(code !== undefined ? { code } : null, status, extra)
const entries = matchKnownErrors(evidence)
console.log(JSON.stringify({ evidence: { httpStatus: evidence.httpStatus, code: evidence.code }, matched: entries }, null, 2))
