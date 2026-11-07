import { useCallback, useEffect, useState } from 'react'
import { DOGS, type Dog } from '../shared/dogs'
import { Composer } from './components/Composer'
import { DogPicker } from './components/DogPicker'
import { Header } from './components/Header'
import { PostsPanel } from './components/PostsPanel'
import { TracePanel } from './components/TracePanel'
import { ApiError, createPost, getAccounts, getConfig, uploadMedia, writeCaption, type Account } from './lib/api'
import { STATUS_LABEL, formatWhen, loadPosts, savePosts, type PostRecord } from './lib/posts'

/** "Invalid API key (HTTP 401)", plus Blotato's error code when there is one. */
function describeError(err: unknown): { text: string; status?: number } {
  if (err instanceof ApiError) {
    const code = (err.body as { code?: unknown } | null)?.code
    const meta = [err.status ? `HTTP ${err.status}` : null, typeof code === 'number' ? `code ${code}` : null]
      .filter(Boolean)
      .join(', ')
    return { text: meta ? `${err.message} (${meta})` : err.message, status: err.status || undefined }
  }
  return { text: err instanceof Error ? err.message : 'Something went wrong.' }
}

async function fetchPhoto(dog: Dog): Promise<Blob> {
  const res = await fetch(dog.photo)
  if (!res.ok) throw new Error(`Could not load ${dog.name}'s photo from this site (HTTP ${res.status}).`)
  return res.blob()
}

function App() {
  // Default to demo mode until the server says otherwise.
  const [demoMode, setDemoMode] = useState(true)
  const [account, setAccount] = useState<Account | null>(null)
  const [selected, setSelected] = useState(DOGS[0].slug)
  // Every dog starts with its hand-written caption. Claude is only called on "Rewrite with Claude".
  const [captions, setCaptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(DOGS.map((d) => [d.slug, d.starterCaption])),
  )
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [posts, setPosts] = useState<PostRecord[]>(() => loadPosts())
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<string | null>(null)

  useEffect(() => {
    getConfig()
      .then((c) => setDemoMode(c.demoMode))
      .catch(() => {})
    getAccounts()
      .then((a) => setAccount(a.items[0] ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => savePosts(posts), [posts])

  const generate = useCallback(async (slug: string, previous?: string) => {
    setLoading((l) => ({ ...l, [slug]: true }))
    setErrors((e) => ({ ...e, [slug]: null }))
    try {
      const res = await writeCaption(slug, previous)
      setCaptions((c) => ({ ...c, [slug]: res.caption }))
    } catch (err) {
      setErrors((e) => ({ ...e, [slug]: err instanceof Error ? err.message : 'Could not write a caption.' }))
    } finally {
      setLoading((l) => ({ ...l, [slug]: false }))
    }
  }, [])

  const dog = DOGS.find((d) => d.slug === selected) ?? DOGS[0]
  const caption = captions[dog.slug] ?? ''

  /** Upload the dog's photo, then create the post. Adds the result to the top of "All posts". */
  async function post(scheduledTime?: string) {
    if (!account || sending) return
    const postDog = dog
    const text = caption
    const record: PostRecord = {
      localId: crypto.randomUUID(),
      dogSlug: postDog.slug,
      dogName: postDog.name,
      caption: text,
      createdAt: new Date().toISOString(),
      status: scheduledTime ? 'scheduled' : 'in-progress',
      scheduledTime,
    }
    const add = (r: PostRecord) => setPosts((ps) => [r, ...ps])

    setSending(true)
    setSendStatus(null)
    try {
      let mediaUrl: string
      try {
        const photo = await fetchPhoto(postDog)
        mediaUrl = (await uploadMedia(`${postDog.slug}.jpg`, photo)).publicUrl
      } catch (err) {
        const e = describeError(err)
        add({ ...record, status: 'failed', failedStep: 'upload', error: `Photo upload failed: ${e.text}`, httpStatus: e.status })
        setSendStatus(`${postDog.name}'s post failed at the photo upload. See All posts.`)
        return
      }

      try {
        const res = await createPost({ accountId: account.id, text, mediaUrls: [mediaUrl], scheduledTime })
        const done: PostRecord = {
          ...record,
          mediaUrl,
          postSubmissionId: res.postSubmissionId,
          // Blotato echoes the resolved UTC time when the post is scheduled.
          scheduledTime: res.scheduledTime ?? scheduledTime,
          status: res.scheduledTime || scheduledTime ? 'scheduled' : 'in-progress',
        }
        add(done)
        setSendStatus(
          done.status === 'scheduled'
            ? `${postDog.name}'s post is scheduled for ${formatWhen(done.scheduledTime!)}.`
            : `${postDog.name}'s post was sent. Status: ${STATUS_LABEL[done.status]}.`,
        )
      } catch (err) {
        const e = describeError(err)
        add({ ...record, mediaUrl, status: 'failed', failedStep: 'create', error: `Post not created: ${e.text}`, httpStatus: e.status })
        setSendStatus(`${postDog.name}'s post failed when sending it to Blotato. See All posts.`)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Header demoMode={demoMode} handle={account?.username.replace(/^@/, '') ?? null} />
      <main className="page">
        <DogPicker dogs={DOGS} selected={selected} onSelect={setSelected} />
        <div className="columns">
          <div className="columns__left">
            <Composer
              dog={dog}
              caption={caption}
              loading={!!loading[dog.slug]}
              error={errors[dog.slug] ?? null}
              handle={account?.username.replace(/^@/, '') ?? null}
              accountReady={!!account}
              sending={sending}
              sendStatus={sendStatus}
              onChange={(text) => setCaptions((c) => ({ ...c, [dog.slug]: text }))}
              onRewrite={() => void generate(dog.slug, caption || undefined)}
              onPost={(t) => void post(t)}
            />
            <PostsPanel posts={posts} />
          </div>
          <div className="columns__right">
            <TracePanel />
          </div>
        </div>
      </main>
    </>
  )
}

export default App
