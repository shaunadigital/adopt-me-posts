// Calls every API route in demo mode and checks the responses.
// Usage:
//   npm run test:demo                                   (against vercel dev on http://localhost:3000)
//   BASE_URL=https://adopt-me-posts.vercel.app npm run test:demo
// Takes about 10 seconds because it waits for demo posts to publish.

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
let failures = 0

function check(name, cond, detail) {
  if (cond) console.log(`  PASS  ${name}`)
  else {
    failures++
    console.log(`  FAIL  ${name}${detail ? `\n        ${JSON.stringify(detail)}` : ''}`)
  }
}

async function api(method, path, body, headers = {}) {
  const isBytes = body instanceof Uint8Array
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? headers : { 'Content-Type': isBytes ? 'image/png' : 'application/json', ...headers },
    body: body === undefined ? undefined : isBytes ? body : JSON.stringify(body),
  })
  let data = null
  try {
    data = await res.json()
  } catch {}
  return { status: res.status, data }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForFinal(id, timeoutMs = 15000) {
  const seen = []
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const { data } = await api('GET', `/api/posts/${encodeURIComponent(id)}`)
    if (data?.status && seen.at(-1) !== data.status) seen.push(data.status)
    if (data?.status === 'published' || data?.status === 'failed') return { final: data, seen }
    await sleep(1000)
  }
  return { final: null, seen }
}

console.log(`Testing ${BASE}\n`)

// Config
const config = await api('GET', '/api/config')
check('GET /api/config → demoMode true', config.status === 200 && config.data?.demoMode === true, config)
if (config.data?.demoMode !== true) {
  console.log('\nNot in demo mode. These tests only run against demo mode, so stopping here.')
  process.exit(1)
}

// Accounts
const accounts = await api('GET', '/api/accounts')
const account = accounts.data?.items?.[0]
check(
  'GET /api/accounts → one Bluesky account',
  accounts.status === 200 && accounts.data.items.length === 1 && account.platform === 'bluesky' &&
    account.username === 'adoptmeposts.bsky.social' && account.id && account.fullname,
  accounts,
)
const filtered = await api('GET', '/api/accounts?platform=threads')
check('GET /api/accounts?platform=threads → empty items', filtered.status === 200 && filtered.data?.items?.length === 0, filtered)

// Media
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const upload = await api('POST', '/api/media/upload?filename=biscuit.png', png)
check(
  'POST /api/media/upload → publicUrl on database.blotato.io',
  upload.status === 201 && upload.data?.publicUrl?.startsWith('https://database.blotato.io/'),
  upload,
)
const badName = await api('POST', '/api/media/upload?filename=notes.txt', png)
check('POST /api/media/upload with .txt → 400', badName.status === 400, badName)

const fromUrl = await api('POST', '/api/media/from-url', { url: 'https://example.com/dogs/biscuit.jpg' })
check('POST /api/media/from-url → { url, id }', fromUrl.status === 201 && fromUrl.data?.url && fromUrl.data?.id, fromUrl)

// Posts
const now = await api('POST', '/api/posts', {
  accountId: account?.id,
  text: 'Meet Biscuit, a goofy 2-year-old who loves belly rubs. #adoptdontshop',
  mediaUrls: upload.data?.publicUrl ? [upload.data.publicUrl] : [],
})
check('POST /api/posts → postSubmissionId, no scheduledTime', now.status === 201 && now.data?.postSubmissionId && !now.data.scheduledTime, now)
const firstStatus = await api('GET', `/api/posts/${encodeURIComponent(now.data?.postSubmissionId)}`)
check('GET /api/posts/:id right after creating → in-progress', firstStatus.data?.status === 'in-progress', firstStatus)

const later = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const sched = await api('POST', '/api/posts', { accountId: account?.id, text: 'Scheduled post for Biscuit.', scheduledTime: later })
check('POST /api/posts with scheduledTime → scheduledTime echoed', sched.status === 201 && sched.data?.scheduledTime === later, sched)
const schedStatus = await api('GET', `/api/posts/${sched.data?.postSubmissionId}`)
check('GET /api/posts/:id (scheduled) → status scheduled', schedStatus.data?.status === 'scheduled', schedStatus)

// Failure posts, created now so they resolve while we wait on the first post
const tooLong = await api('POST', '/api/posts', { accountId: account?.id, text: 'x'.repeat(301) })
const forcedDisc = await api('POST', '/api/posts?demoFail=disconnected-account', { accountId: account?.id, text: 'Hello' })
const forcedMedia = await api('POST', '/api/posts', { accountId: account?.id, text: 'Hi', mediaUrls: ['https://example.com/a.jpg'] }, { 'x-demo-fail': 'bad-media-url' })

const published = await waitForFinal(now.data?.postSubmissionId)
check(
  'Post then reaches published with a bsky.app publicUrl',
  published.final?.status === 'published' &&
    published.final.publicUrl?.startsWith('https://bsky.app/profile/adoptmeposts.bsky.social/post/'),
  published,
)

const longResult = await waitForFinal(tooLong.data?.postSubmissionId)
check(
  'Text over 300 characters → failed with Blotato error 20005 wording',
  longResult.final?.status === 'failed' && /character limit of 300 characters for platform bluesky \(error code 20005\)/.test(longResult.final.errorMessage),
  longResult,
)
const discResult = await waitForFinal(forcedDisc.data?.postSubmissionId)
check(
  'demoFail=disconnected-account → failed "Invalid account credentials"',
  discResult.final?.status === 'failed' && discResult.final.errorMessage === 'Invalid account credentials',
  discResult,
)
const mediaResult = await waitForFinal(forcedMedia.data?.postSubmissionId)
check(
  'x-demo-fail: bad-media-url on a post → failed with fetch error',
  mediaResult.final?.status === 'failed' && /could not fetch the media URL/.test(mediaResult.final.errorMessage),
  mediaResult,
)

// Request-level failures
const badKey = await api('GET', '/api/accounts?demoFail=invalid-key')
check('demoFail=invalid-key → 401 with message', badKey.status === 401 && badKey.data?.message, badKey)
const badMedia = await api('POST', '/api/media/from-url?demoFail=bad-media-url', { url: 'https://example.com/x.jpg' })
check('demoFail=bad-media-url on media → 422 code 90009', badMedia.status === 422 && badMedia.data?.code === 90009, badMedia)
const unreachable = await api('POST', '/api/media/from-url', { url: 'not a url' })
check('Unfetchable media URL → 422 code 90009', unreachable.status === 422 && unreachable.data?.code === 90009, unreachable)
const unknownFail = await api('GET', '/api/accounts?demoFail=nope')
check('Unknown demoFail → 400', unknownFail.status === 400, unknownFail)
const missing = await api('GET', '/api/posts/not-a-real-id')
check('Unknown post ID → 404 "Not found"', missing.status === 404 && missing.data?.message === 'Not found', missing)

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
