// POST /api/media/from-url  { "url": "https://..." } → Blotato POST /v2/media
// Response: { url, id }. A URL Blotato can't fetch returns code 90009.
import { uploadFromUrl } from '../_lib/blotato.js'
import { json, readDemoFail, readJson, relay } from '../_lib/http.js'

export async function POST(req: Request) {
  const demoFail = readDemoFail(req)
  if (demoFail instanceof Response) return demoFail
  const body = await readJson(req)
  if (body instanceof Response) return body
  if (typeof body.url !== 'string') return json(400, { message: 'Add "url" with the public media URL.' })
  return relay(await uploadFromUrl(body.url, { demoFail }))
}
