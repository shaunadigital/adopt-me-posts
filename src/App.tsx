import { useCallback, useEffect, useRef, useState } from 'react'
import { DOGS, type Dog } from '../shared/dogs'
import { Composer } from './components/Composer'
import { DogPicker } from './components/DogPicker'
import { Header } from './components/Header'
import { PostsPanel } from './components/PostsPanel'
import { KnownErrorsPage } from './components/KnownErrorsPage'
import { PostDoctor, type DoctorMode, type TicketState, type TrimState } from './components/PostDoctor'
import { TracePanel } from './components/TracePanel'
import {
  ApiError,
  createPost,
  diagnose,
  diagnoseTicket,
  getAccounts,
  getConfig,
  getPostStatus,
  uploadMedia,
  writeCaption,
  type Account,
  type PostStatusResult,
} from './lib/api'
import { buildExamples } from './lib/examples'
import { TICKET_EXAMPLES, exampleIds, findPostId, type TicketExample, type TicketLookup } from './lib/tickets'

const TICKET_EXAMPLES_BY_KEY = Object.fromEntries(TICKET_EXAMPLES.map((e) => [e.key, e])) as Record<TicketExample['key'], TicketExample>
import {
  RESULT_LABEL,
  formatLater,
  formatMs,
  formatWhen,
  loadPosts,
  savePosts,
  setStep,
  type PostRecord,
  type TraceStep,
} from './lib/posts'
import { countCaption } from './lib/text'

const DEMO_HANDLE = 'adoptmeposts.bsky.social'
const TICK_MS = 3000
/** Check every tick for the first minute of a post's life in the queue, then every 15 s. */
const FAST_CHECKS = 20
const SLOW_CHECK_MS = 15_000

/** "Invalid API key (HTTP 401)", plus Blotato's error code when there is one. */
function describeError(err: unknown): { text: string; status?: number; ms?: number; body?: unknown } {
  if (err instanceof ApiError) {
    const code = (err.body as { code?: unknown } | null)?.code
    const meta = [err.status ? `HTTP ${err.status}` : null, typeof code === 'number' ? `code ${code}` : null]
      .filter(Boolean)
      .join(', ')
    return { text: meta ? `${err.message} (${meta})` : err.message, status: err.status || undefined, ms: err.ms, body: err.body }
  }
  return { text: err instanceof Error ? err.message : 'Something went wrong.' }
}

async function fetchPhoto(dog: Dog): Promise<Blob> {
  const res = await fetch(dog.photo)
  if (!res.ok) throw new Error(`Could not load ${dog.name}'s photo from this site (HTTP ${res.status}).`)
  return res.blob()
}

/** Where the current caption came from, for the trace's first step. */
interface CaptionSource {
  kind: 'starter' | 'claude' | 'edited' | 'trimmed'
  ms?: number
  http?: number
  at: string
}

function App() {
  const [demoMode, setDemoMode] = useState(true) // until the server says otherwise
  const [configLoaded, setConfigLoaded] = useState(false)
  const [account, setAccount] = useState<Account | null>(null)
  const [selected, setSelected] = useState(DOGS[0].slug)
  // Every dog starts with its hand-written caption. Claude is only called on "Rewrite with Claude".
  const [captions, setCaptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(DOGS.map((d) => [d.slug, d.starterCaption])),
  )
  const [captionSource, setCaptionSource] = useState<Record<string, CaptionSource>>(() =>
    Object.fromEntries(DOGS.map((d) => [d.slug, { kind: 'starter', at: new Date().toISOString() }])),
  )
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [posts, setPosts] = useState<PostRecord[]>(() => loadPosts())
  const [selectedPost, setSelectedPost] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<string | null>(null)

  // Two views: the main screen, and the Known errors page at #known-errors.
  const routeFromHash = () => (window.location.hash === '#known-errors' ? 'known-errors' : 'main')
  const [route, setRoute] = useState<'main' | 'known-errors'>(routeFromHash)
  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const hadSavedPosts = useRef(posts.length > 0)
  const seeded = useRef(false)

  useEffect(() => {
    // configLoaded only turns true when the server answered, so examples are never seeded on a guess.
    getConfig()
      .then((c) => {
        setDemoMode(c.demoMode)
        setConfigLoaded(true)
      })
      .catch(() => {})
    getAccounts()
      .then((a) => setAccount(a.items[0] ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => savePosts(posts), [posts])

  const updatePost = useCallback((localId: string, fn: (p: PostRecord) => PostRecord) => {
    setPosts((ps) => ps.map((p) => (p.localId === localId ? fn(p) : p)))
  }, [])

  // ---- Example posts (demo mode only) ----

  const seedExamples = useCallback(() => {
    const examples = buildExamples(account?.username.replace(/^@/, '') || DEMO_HANDLE)
    // Merge with the user's own posts, newest first.
    setPosts((ps) =>
      [...examples, ...ps.filter((p) => !p.example)].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    )
    setSelectedPost(examples.find((p) => p.status === 'failed')?.localId ?? null)
  }, [account])

  useEffect(() => {
    if (!configLoaded || seeded.current) return
    seeded.current = true
    if (!demoMode) {
      // With a real Blotato key there are no examples, even ones saved from an earlier demo visit.
      setPosts((ps) => ps.filter((p) => !p.example))
      return
    }
    // Examples saved before the post doctor existed have no saved diagnosis: swap in fresh ones.
    const staleExamples = loadPosts().some((p) => p.example && p.status === 'failed' && !p.doctor)
    if (!hadSavedPosts.current || staleExamples) seedExamples()
  }, [configLoaded, demoMode, seedExamples])

  // ---- Status updates ----

  const postsRef = useRef(posts)
  postsRef.current = posts
  const lastCheck = useRef(new Map<string, number>())
  const inFlight = useRef(new Set<string>())

  const applyStatus = useCallback(
    (localId: string, res: { data: PostStatusResult; status: number; ms: number }) => {
      const now = Date.now()
      const { data } = res
      updatePost(localId, (p) => {
        const since = now - new Date(p.queuedAt ?? p.createdAt).getTime()
        const checks = (p.checks ?? 0) + 1
        if (data.status === 'published') {
          const step: TraceStep = {
            key: 'result',
            label: RESULT_LABEL.published,
            state: 'ok',
            meta: `published · ${formatLater(since)}`,
            http: res.status,
            ms: res.ms,
            note: 'Blotato confirmed it is live',
            link: data.publicUrl,
            at: new Date(now).toISOString(),
          }
          return { ...p, status: 'published', publicUrl: data.publicUrl, checks, trace: setStep(p.trace, step) }
        }
        if (data.status === 'failed') {
          const message = data.errorMessage || 'Blotato reported the post as failed, with no message.'
          const step: TraceStep = {
            key: 'result',
            label: RESULT_LABEL.failed,
            state: 'failed',
            meta: `failed · ${formatLater(since)}`,
            http: res.status,
            ms: res.ms,
            note: message,
            at: new Date(now).toISOString(),
          }
          return {
            ...p,
            status: 'failed',
            failedStep: 'result',
            error: message,
            httpStatus: res.status,
            rawError: data,
            checks,
            trace: setStep(p.trace, step),
          }
        }
        // Still in progress (or Blotato still has it as scheduled).
        const step: TraceStep = {
          key: 'result',
          label: RESULT_LABEL.waiting,
          state: 'waiting',
          meta: `${data.status} · ${res.status}`,
          http: res.status,
          note: `Checked ${checks} ${checks === 1 ? 'time' : 'times'}, still ${data.status === 'scheduled' ? 'scheduled' : 'in progress'}`,
        }
        return { ...p, checks, trace: setStep(p.trace, step) }
      })
    },
    [updatePost],
  )

  const checkPost = useCallback(
    async (p: PostRecord) => {
      if (!p.postSubmissionId || inFlight.current.has(p.localId)) return
      inFlight.current.add(p.localId)
      lastCheck.current.set(p.localId, Date.now())
      try {
        applyStatus(p.localId, await getPostStatus(p.postSubmissionId))
      } catch (err) {
        const e = describeError(err)
        const permanent = e.status !== undefined && e.status >= 400 && e.status < 500 && e.status !== 429
        updatePost(p.localId, (cur) => {
          if (!permanent) {
            // Network trouble, rate limit or server error: keep checking.
            const step: TraceStep = {
              key: 'result',
              label: RESULT_LABEL.waiting,
              state: 'waiting',
              meta: e.status ? `retrying · ${e.status}` : 'retrying',
              http: e.status,
              note: `Last check failed: ${e.text}. Trying again.`,
            }
            return { ...cur, trace: setStep(cur.trace, step) }
          }
          const step: TraceStep = {
            key: 'result',
            label: RESULT_LABEL.checkFailed,
            state: 'failed',
            meta: `${e.status} · ${e.ms ?? 0} ms`,
            http: e.status,
            ms: e.ms,
            note: e.text,
            at: new Date().toISOString(),
          }
          return {
            ...cur,
            status: 'failed',
            failedStep: 'result',
            error: `Status check failed: ${e.text}`,
            httpStatus: e.status,
            rawError: e.body,
            trace: setStep(cur.trace, step),
          }
        })
      } finally {
        inFlight.current.delete(p.localId)
      }
    },
    [applyStatus, updatePost],
  )

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      // Scheduled posts flip to In progress at their time.
      const due = postsRef.current.filter(
        (p) => p.status === 'scheduled' && p.scheduledTime && new Date(p.scheduledTime).getTime() <= now,
      )
      for (const p of due) {
        updatePost(p.localId, (cur) => ({
          ...cur,
          status: 'in-progress',
          queuedAt: cur.scheduledTime,
          trace: setStep(cur.trace, {
            key: 'result',
            label: RESULT_LABEL.waiting,
            state: 'waiting',
            meta: 'in-progress',
            note: `Scheduled time reached (${formatWhen(cur.scheduledTime!)}). Checking with Blotato.`,
          }),
        }))
      }
      // Poll In progress posts; stop once they're Published or Failed.
      for (const p of postsRef.current) {
        if (p.status !== 'in-progress' || !p.postSubmissionId) continue
        const wait = (p.checks ?? 0) < FAST_CHECKS ? TICK_MS - 200 : SLOW_CHECK_MS
        if (now - (lastCheck.current.get(p.localId) ?? 0) >= wait) void checkPost(p)
      }
    }
    tick()
    const t = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(t)
  }, [checkPost, updatePost])

  // ---- Captions ----

  const generate = useCallback(async (slug: string, previous?: string) => {
    setLoading((l) => ({ ...l, [slug]: true }))
    setErrors((e) => ({ ...e, [slug]: null }))
    try {
      const res = await writeCaption(slug, previous)
      setCaptions((c) => ({ ...c, [slug]: res.data.caption }))
      setCaptionSource((s) => ({ ...s, [slug]: { kind: 'claude', ms: res.ms, http: res.status, at: new Date().toISOString() } }))
    } catch (err) {
      setErrors((e) => ({ ...e, [slug]: err instanceof Error ? err.message : 'Could not write a caption.' }))
    } finally {
      setLoading((l) => ({ ...l, [slug]: false }))
    }
  }, [])

  const dog = DOGS.find((d) => d.slug === selected) ?? DOGS[0]
  const caption = captions[dog.slug] ?? ''

  // ---- Posting ----

  /** Upload the dog's photo, then create the post. Adds it to the top of "All posts" and selects it. */
  /** override: post this dog and text instead of the composer's (used by "Trim and resend"). */
  async function post(scheduledTime?: string, override?: { dog: Dog; text: string; source: CaptionSource }) {
    if (!account || sending) return
    const postDog = override?.dog ?? dog
    const text = override?.text ?? caption
    const source = override?.source ?? captionSource[postDog.slug]
    const createdAt = new Date().toISOString()
    const captionStep: TraceStep = {
      key: 'caption',
      label: 'Caption written',
      state: 'ok',
      meta:
        source.kind === 'claude' || source.kind === 'trimmed'
          ? `Claude · ${formatMs(source.ms ?? 0)}`
          : source.kind === 'edited'
            ? 'edited'
            : 'starter',
      http: source.http,
      ms: source.ms,
      note: `${countCaption(text)} characters for Bluesky${
        source.kind === 'starter'
          ? ', hand-written starter'
          : source.kind === 'edited'
            ? ', edited by hand'
            : source.kind === 'trimmed'
              ? ', shortened by the post doctor'
              : ''
      }`,
      at: source.at,
    }
    const notReached = (key: 'create' | 'result', label: string): TraceStep => ({
      key,
      label,
      state: 'skipped',
      note: 'Not reached',
    })
    const record: PostRecord = {
      localId: crypto.randomUUID(),
      dogSlug: postDog.slug,
      dogName: postDog.name,
      caption: text,
      createdAt,
      status: scheduledTime ? 'scheduled' : 'in-progress',
      scheduledTime,
      trace: [captionStep],
    }
    const add = (r: PostRecord) => {
      setPosts((ps) => [r, ...ps])
      setSelectedPost(r.localId)
    }

    setSending(true)
    setSendStatus(null)
    try {
      // Step: photo upload
      let mediaUrl: string
      let uploadStep: TraceStep
      try {
        const photo = await fetchPhoto(postDog)
        const up = await uploadMedia(`${postDog.slug}.jpg`, photo)
        mediaUrl = up.data.publicUrl
        uploadStep = {
          key: 'upload',
          label: 'Photo uploaded',
          state: 'ok',
          meta: `${up.status} · ${formatMs(up.ms)}`,
          http: up.status,
          ms: up.ms,
          note: `${postDog.slug}.jpg sent to Blotato storage`,
          at: new Date().toISOString(),
        }
      } catch (err) {
        const e = describeError(err)
        add({
          ...record,
          status: 'failed',
          failedStep: 'upload',
          error: `Photo upload failed: ${e.text}`,
          httpStatus: e.status,
          rawError: e.body,
          trace: [
            captionStep,
            {
              key: 'upload',
              label: 'Photo upload failed',
              state: 'failed',
              meta: e.status ? `${e.status} · ${formatMs(e.ms ?? 0)}` : 'no response',
              http: e.status,
              ms: e.ms,
              note: e.text,
              at: new Date().toISOString(),
            },
            notReached('create', 'Post sent to Blotato'),
            notReached('result', 'Result from Blotato'),
          ],
        })
        setSendStatus(`${postDog.name}'s post failed at the photo upload. See the post trace.`)
        return
      }

      // Step: create the post
      try {
        const res = await createPost({ accountId: account.id, text, mediaUrls: [mediaUrl], scheduledTime })
        const when = res.data.scheduledTime ?? scheduledTime
        const createStep: TraceStep = {
          key: 'create',
          label: 'Post sent to Blotato',
          state: 'ok',
          meta: `${res.status} · ${formatMs(res.ms)}`,
          http: res.status,
          ms: res.ms,
          note: when ? `Blotato queued it for ${formatWhen(when)}` : 'Blotato accepted it and passed it to Bluesky',
          at: new Date().toISOString(),
        }
        const resultStep: TraceStep = when
          ? { key: 'result', label: RESULT_LABEL.scheduled, state: 'scheduled', meta: 'scheduled', note: `Goes out ${formatWhen(when)}` }
          : { key: 'result', label: RESULT_LABEL.waiting, state: 'waiting', meta: 'in-progress', note: 'Checking with Blotato every few seconds' }
        const done: PostRecord = {
          ...record,
          mediaUrl,
          postSubmissionId: res.data.postSubmissionId,
          // Blotato echoes the resolved UTC time when the post is scheduled.
          scheduledTime: when,
          status: when ? 'scheduled' : 'in-progress',
          queuedAt: when ? undefined : new Date().toISOString(),
          trace: [captionStep, uploadStep, createStep, resultStep],
        }
        add(done)
        setSendStatus(
          done.status === 'scheduled'
            ? `${postDog.name}'s post is scheduled for ${formatWhen(when!)}.`
            : `${postDog.name}'s post was sent to Blotato. Follow it in the post trace.`,
        )
      } catch (err) {
        const e = describeError(err)
        add({
          ...record,
          mediaUrl,
          status: 'failed',
          failedStep: 'create',
          error: `Post not created: ${e.text}`,
          httpStatus: e.status,
          rawError: e.body,
          trace: [
            captionStep,
            uploadStep,
            {
              key: 'create',
              label: 'Post not created',
              state: 'failed',
              meta: e.status ? `${e.status} · ${formatMs(e.ms ?? 0)}` : 'no response',
              http: e.status,
              ms: e.ms,
              note: e.text,
              at: new Date().toISOString(),
            },
            notReached('result', 'Result from Blotato'),
          ],
        })
        setSendStatus(`${postDog.name}'s post failed when sending it to Blotato. See the post trace.`)
      }
    } finally {
      setSending(false)
    }
  }

  // ---- Post doctor ----

  const [doctorLoading, setDoctorLoading] = useState<Record<string, boolean>>({})
  const [doctorErrors, setDoctorErrors] = useState<Record<string, string | null>>({})
  const doctorTried = useRef(new Set<string>())
  const [trim, setTrim] = useState<TrimState>({ status: 'idle', text: '' })
  const [doctorMode, setDoctorMode] = useState<DoctorMode>('post')
  const [ticket, setTicket] = useState<TicketState>({ text: '', exampleKey: null, status: 'idle' })

  const runDoctor = useCallback(
    async (p: PostRecord) => {
      setDoctorLoading((l) => ({ ...l, [p.localId]: true }))
      setDoctorErrors((e) => ({ ...e, [p.localId]: null }))
      try {
        const result = await diagnose(p)
        updatePost(p.localId, (cur) => ({ ...cur, doctor: result }))
      } catch (err) {
        setDoctorErrors((e) => ({ ...e, [p.localId]: `The post doctor couldn't run: ${describeError(err).text}` }))
      } finally {
        setDoctorLoading((l) => ({ ...l, [p.localId]: false }))
      }
    },
    [updatePost],
  )

  const current = posts.find((p) => p.localId === selectedPost) ?? null

  // Diagnose a failed post the first time it's selected, once; the result is cached on the post.
  useEffect(() => {
    if (!current || current.status !== 'failed' || current.doctor || doctorTried.current.has(current.localId)) return
    // Example posts ship with a saved diagnosis and never call Claude on load.
    if (current.example) return
    doctorTried.current.add(current.localId)
    void runDoctor(current)
  }, [current, runDoctor])

  // A trim proposal belongs to one post; drop it when the selection changes.
  useEffect(() => setTrim({ status: 'idle', text: '' }), [selectedPost])

  async function startTrim() {
    if (!current) return
    setTrim({ status: 'writing', text: '' })
    try {
      const res = await writeCaption(current.dogSlug, undefined, current.caption)
      setTrim({ status: 'ready', text: res.data.caption, ms: res.ms, http: res.status })
    } catch (err) {
      setTrim({ status: 'error', text: '', error: `Couldn't shorten the caption: ${describeError(err).text}` })
    }
  }

  // ---- Paste a ticket ----

  function pickTicketExample(ex: TicketExample) {
    setTicket({ text: ex.text(exampleIds(posts)), exampleKey: ex.key, status: 'idle' })
  }

  /** Show a saved example lookup with this browser's copy of the example post (ID and scheduled time). */
  function localizeLookup(l: TicketLookup, id: string | undefined): TicketLookup {
    const local = id ? posts.find((p) => p.postSubmissionId === id) : undefined
    if (!local) return { ...l, savedHere: false }
    const raw = l.raw && typeof l.raw === 'object' ? { ...(l.raw as Record<string, unknown>), postSubmissionId: id } : l.raw
    if (raw && typeof raw === 'object' && local.scheduledTime) (raw as Record<string, unknown>).scheduledTime = local.scheduledTime
    return { ...l, postSubmissionId: id!, savedHere: true, raw }
  }

  async function runTicket() {
    const text = ticket.text.trim()
    if (!text) return
    // Unedited examples show their saved result: no Claude call, no lookup.
    const ex = ticket.exampleKey ? TICKET_EXAMPLES_BY_KEY[ticket.exampleKey] : undefined
    if (ex?.saved) {
      const saved = ex.saved
      const ids = exampleIds(posts)
      const id = saved.lookup?.postSubmissionId && (ex.key === 'rocket' ? ids.rocket : ex.key === 'scheduled' ? ids.pip : undefined)
      setTicket((t) => ({
        ...t,
        status: 'done',
        doctor: { ...saved.doctor },
        // Point "Show this post" at this browser's copy of the example post.
        lookup: saved.lookup ? localizeLookup(saved.lookup, id) : null,
      }))
      return
    }

    setTicket((t) => ({ ...t, status: 'working', error: undefined }))
    try {
      const id = findPostId(text)
      let lookup: TicketLookup | null = null
      let apiLookup: Parameters<typeof diagnoseTicket>[0]['lookup'] = null
      const saved = id ? posts.find((p) => p.postSubmissionId === id) : undefined
      if (id) {
        try {
          const res = await getPostStatus(id)
          lookup = { postSubmissionId: id, savedHere: !!saved, dogName: saved?.dogName, liveStatus: res.data.status, raw: res.data }
          apiLookup = { postSubmissionId: id, liveStatus: res.data, liveError: null }
        } catch (err) {
          const e = describeError(err)
          lookup = { postSubmissionId: id, savedHere: !!saved, dogName: saved?.dogName, liveError: e.text, raw: e.body ?? null }
          apiLookup = { postSubmissionId: id, liveStatus: null, liveError: { status: e.status ?? 0, message: e.text } }
        }
      }
      const doctor = await diagnoseTicket({ ticket: text, lookup: apiLookup, post: saved })
      setTicket((t) => ({ ...t, status: 'done', doctor, lookup }))
    } catch (err) {
      setTicket((t) => ({ ...t, status: 'error', error: `The post doctor couldn't read this ticket: ${describeError(err).text}` }))
    }
  }

  function showPost(postSubmissionId: string) {
    const p = posts.find((x) => x.postSubmissionId === postSubmissionId)
    if (!p) return
    setSelectedPost(p.localId)
    document.getElementById('posts-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function postTrimmed() {
    const d = current && DOGS.find((x) => x.slug === current.dogSlug)
    if (!d || trim.status !== 'ready') return
    const text = trim.text.trim()
    const source: CaptionSource = { kind: 'trimmed', ms: trim.ms, http: trim.http, at: new Date().toISOString() }
    setTrim({ status: 'idle', text: '' })
    await post(undefined, { dog: d, text, source })
  }

  const handle = account?.username.replace(/^@/, '') ?? null
  // Known errors page (reached from the post doctor).
  if (route === 'known-errors') return <KnownErrorsPage demoMode={demoMode} handle={handle} />

  return (
    <>
      <Header demoMode={demoMode} handle={handle} />
      <main className="page">
        <DogPicker dogs={DOGS} selected={selected} onSelect={setSelected} />
        <div className="columns">
          <div className="columns__left">
            <Composer
              dog={dog}
              caption={caption}
              loading={!!loading[dog.slug]}
              error={errors[dog.slug] ?? null}
              handle={handle}
              accountReady={!!account}
              sending={sending}
              sendStatus={sendStatus}
              onChange={(text) => {
                setCaptions((c) => ({ ...c, [dog.slug]: text }))
                setCaptionSource((s) =>
                  s[dog.slug]?.kind === 'edited' ? s : { ...s, [dog.slug]: { ...s[dog.slug], kind: 'edited', at: new Date().toISOString() } },
                )
              }}
              onRewrite={() => void generate(dog.slug, caption || undefined)}
              onPost={(t) => void post(t)}
            />
            <PostsPanel
              posts={posts}
              selectedId={selectedPost}
              onSelect={(id) => {
                setSelectedPost(id)
                // On phones the trace is below the list, so bring it into view.
                if (window.matchMedia('(max-width: 640px)').matches) {
                  requestAnimationFrame(() =>
                    document.getElementById('trace-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                  )
                }
              }}
              onResetExamples={demoMode && configLoaded ? seedExamples : undefined}
            />
          </div>
          <div className="columns__right">
            <TracePanel
              post={current}
              demoMode={demoMode}
              doctor={
                <PostDoctor
                  post={current}
                  loading={!!(current && doctorLoading[current.localId])}
                  error={current ? (doctorErrors[current.localId] ?? null) : null}
                  onRetry={() => current && void runDoctor(current)}
                  onReplyChange={(text) =>
                    current && updatePost(current.localId, (p) => (p.doctor ? { ...p, doctor: { ...p.doctor, reply: text } } : p))
                  }
                  trim={trim}
                  sending={sending}
                  onTrimStart={() => void startTrim()}
                  onTrimChange={(text) => setTrim((t) => ({ ...t, text }))}
                  onTrimPost={() => void postTrimmed()}
                  onTrimCancel={() => setTrim({ status: 'idle', text: '' })}
                  mode={doctorMode}
                  onModeChange={setDoctorMode}
                  ticket={ticket}
                  onTicketText={(text) => setTicket((t) => ({ ...t, text, exampleKey: null }))}
                  onTicketExample={pickTicketExample}
                  onTicketRun={() => void runTicket()}
                  onTicketReply={(text) => setTicket((t) => (t.doctor ? { ...t, doctor: { ...t.doctor, reply: text } } : t))}
                  onShowPost={showPost}
                />
              }
            />
          </div>
        </div>
      </main>
    </>
  )
}

export default App
