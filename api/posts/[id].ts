// GET /api/posts/:postSubmissionId → Blotato GET /v2/posts/{postSubmissionId}
// Response: { postSubmissionId, status: in-progress|scheduled|published|failed, scheduledTime?, publicUrl?, errorMessage? }
import { getPostStatus } from '../_lib/blotato.js'
import { json, readDemoFail, relay } from '../_lib/http.js'

export async function GET(req: Request) {
  const demoFail = readDemoFail(req)
  if (demoFail instanceof Response) return demoFail
  const id = decodeURIComponent(new URL(req.url).pathname.split('/').pop() ?? '')
  if (!id || id.length > 200) return json(400, { message: 'Missing post ID.' })
  return relay(await getPostStatus(id, { demoFail }))
}
