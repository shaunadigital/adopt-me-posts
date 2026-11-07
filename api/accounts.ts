// GET /api/accounts?platform=bluesky → Blotato GET /v2/users/me/accounts
// Response: { items: [{ id, platform, fullname, username }] }
import { listAccounts } from './_lib/blotato.js'
import { json, readDemoFail, relay } from './_lib/http.js'
import type { Platform } from './_lib/types.js'

export async function GET(req: Request) {
  const demoFail = readDemoFail(req)
  if (demoFail instanceof Response) return demoFail
  const platform = new URL(req.url).searchParams.get('platform') || undefined
  if (platform && !/^[a-z]+$/.test(platform)) return json(400, { message: 'Invalid platform.' })
  return relay(await listAccounts(platform as Platform | undefined, { demoFail }))
}
