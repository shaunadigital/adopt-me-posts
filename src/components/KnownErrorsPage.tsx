// Known errors: every entry in docs/known-errors.json with its source links.
// Reached from the post doctor (#known-errors).
import data from '../../docs/known-errors.json' with { type: 'json' }
import { Header } from './Header'

interface Entry {
  id: string
  title: string
  wording: string[]
  stage: string
  cause: string
  fix: string
  sources: { title: string; url: string }[]
  inDocs: boolean
  docsNote?: string
}

const ENTRIES = data.entries as Entry[]

export function KnownErrorsPage({ demoMode, handle }: { demoMode: boolean; handle: string | null }) {
  return (
    <>
      <Header demoMode={demoMode} handle={handle} />
      <main className="page known">
        <div className="known__head">
          <a href="#" className="known__back">
            ← Back to posts
          </a>
          <h2 className="known__title">Known errors</h2>
          <p className="muted known__intro">
            Blotato errors this app can run into, with the cause and fix in plain words. Each one links the Blotato doc
            it comes from. The post doctor only cites these links. Collected {data.collected}.
          </p>
        </div>
        <ol className="known__list">
          {ENTRIES.map((e) => (
            <li key={e.id} id={e.id} className="panel known__item">
              <div className="known__item-head">
                <h3 className="known__item-title">{e.title}</h3>
                {!e.inDocs && <span className="tag-notdocs">Not in Blotato's docs</span>}
              </div>
              <ul className="known__wording">
                {e.wording.map((w) => (
                  <li key={w} className="mono">
                    {w}
                  </li>
                ))}
              </ul>
              <dl className="known__dl">
                <dt>When</dt>
                <dd>{e.stage}</dd>
                <dt>Cause</dt>
                <dd>{e.cause}</dd>
                <dt>Fix</dt>
                <dd>{e.fix}</dd>
              </dl>
              {e.docsNote && <p className="known__note">{e.docsNote}</p>}
              <p className="known__sources">
                <span className="muted">Source{e.sources.length > 1 ? 's' : ''}: </span>
                {e.sources.map((s, i) => (
                  <span key={s.url + s.title}>
                    {i > 0 && ' · '}
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ol>
      </main>
    </>
  )
}
