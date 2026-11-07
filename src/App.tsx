import { useCallback, useEffect, useRef, useState } from 'react'
import { DOGS } from '../shared/dogs'
import { Composer } from './components/Composer'
import { DogPicker } from './components/DogPicker'
import { Header } from './components/Header'
import { PostsPanel } from './components/PostsPanel'
import { TracePanel } from './components/TracePanel'
import { getAccounts, getConfig, writeCaption } from './lib/api'

function App() {
  // Default to demo mode until the server says otherwise.
  const [demoMode, setDemoMode] = useState(true)
  const [handle, setHandle] = useState<string | null>(null)
  const [selected, setSelected] = useState(DOGS[0].slug)
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const requested = useRef(new Set<string>())

  useEffect(() => {
    getConfig()
      .then((c) => setDemoMode(c.demoMode))
      .catch(() => {})
    getAccounts()
      .then((a) => setHandle(a.items[0]?.username.replace(/^@/, '') ?? null))
      .catch(() => {})
  }, [])

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

  // Write a first caption the first time each dog is opened.
  useEffect(() => {
    if (requested.current.has(selected)) return
    requested.current.add(selected)
    void generate(selected)
  }, [selected, generate])

  const dog = DOGS.find((d) => d.slug === selected) ?? DOGS[0]
  const caption = captions[dog.slug] ?? ''

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
              onChange={(text) => setCaptions((c) => ({ ...c, [dog.slug]: text }))}
              onRewrite={() => void generate(dog.slug, caption || undefined)}
            />
            <PostsPanel />
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
