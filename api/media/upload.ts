// POST /api/media/upload?filename=dog.jpg with the raw file bytes as the body.
// Gets a presigned URL from Blotato (POST /v2/media/uploads), PUTs the bytes to it,
// and returns { publicUrl } to use in a post's mediaUrls.
// Vercel caps request bodies at 4.5 MB, which is fine for photos.
import { createUploadUrl, putToPresignedUrl } from '../_lib/blotato.js'
import { json, readDemoFail, relay } from '../_lib/http.js'
import type { PresignedUploadResponse } from '../_lib/types.js'

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
}

export async function POST(req: Request) {
  const demoFail = readDemoFail(req)
  if (demoFail instanceof Response) return demoFail

  const filename = new URL(req.url).searchParams.get('filename')?.trim()
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (!filename || !ext || !CONTENT_TYPES[ext]) {
    return json(400, { message: `Add ?filename= with one of these extensions: ${Object.keys(CONTENT_TYPES).join(', ')}.` })
  }

  const bytes = await req.arrayBuffer()
  if (bytes.byteLength === 0) return json(400, { message: 'The request body is empty. Send the file bytes as the body.' })

  const presign = await createUploadUrl(filename, { demoFail })
  if (!presign.ok) return relay(presign)
  const { presignedUrl, publicUrl } = presign.body as PresignedUploadResponse

  const put = await putToPresignedUrl(presignedUrl, bytes, req.headers.get('content-type') || CONTENT_TYPES[ext])
  if (!put.ok) return json(502, { message: `Upload to Blotato storage failed with HTTP ${put.status}.` })

  return json(201, { publicUrl })
}
