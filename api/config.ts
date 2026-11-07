// GET /api/config: public app config. Never returns key values, only whether demo mode is on.
// Demo mode: BLOTATO_API_KEY is empty, so Blotato calls return fake responses.
import { isDemoMode } from './_lib/blotato.js'
import { json } from './_lib/http.js'

export function GET() {
  return json(200, { demoMode: isDemoMode() })
}
