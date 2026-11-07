import { useState } from 'react'
import { TOO_LONG_IDS, type PostRecord } from '../lib/posts'
import { BLUESKY_LIMIT, countGraphemes } from '../lib/text'

export interface TrimState {
  status: 'idle' | 'writing' | 'ready' | 'error'
  text: string
  error?: string
  ms?: number // how long Claude took, for the new post's trace
  http?: number
}

interface Props {
  post: PostRecord | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onReplyChange: (text: string) => void
  trim: TrimState
  sending: boolean
  onTrimStart: () => void
  onTrimChange: (text: string) => void
  onTrimPost: () => void
  onTrimCancel: () => void
}

function DoctorIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#5FD1B3"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  )
}

export function PostDoctor(props: Props) {
  const { post, loading, error, onRetry, onReplyChange, trim, sending, onTrimStart, onTrimChange, onTrimPost, onTrimCancel } = props
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)
  const doctor = post?.doctor
  const failed = post?.status === 'failed'

  async function copy() {
    if (!doctor) return
    try {
      await navigator.clipboard.writeText(doctor.reply)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const head = (
    <div className="doctor__head">
      <DoctorIcon />
      <h3 className="doctor__title">Post doctor</h3>
      <a className="doctor__known" href="#known-errors">
        Known errors
      </a>
    </div>
  )

  if (!post || !failed) {
    return (
      <div className="doctor">
        {head}
        <p>When a post fails, the cause, the fix and a reply you can send the customer show up here.</p>
      </div>
    )
  }

  const canTrim = !!doctor?.entries.some((e) => TOO_LONG_IDS.includes(e.id))
  const trimCount = countGraphemes(trim.text)
  const trimOver = trimCount > BLUESKY_LIMIT

  return (
    <div className="doctor" aria-live="polite" aria-busy={loading}>
      {head}

      {loading && <p>Reading the trace and Blotato's docs…</p>}

      {!loading && !error && !doctor && (
        <div className="doctor__actions">
          <button type="button" className="btn-mint" onClick={onRetry}>
            Diagnose this post
          </button>
        </div>
      )}

      {!loading && error && (
        <>
          <p className="doctor__error">{error}</p>
          <div className="doctor__actions">
            <button type="button" className="btn-dark" onClick={onRetry}>
              Try again
            </button>
          </div>
        </>
      )}

      {!loading && doctor && (
        <>
          {!doctor.matched && (
            <p className="doctor__note">This error isn't in the known errors list yet, so there are no doc links for it.</p>
          )}
          <dl className="doctor__dl">
            <dt>Cause</dt>
            <dd>{doctor.cause}</dd>
            <dt>Fix</dt>
            <dd>{doctor.fix}</dd>
          </dl>
          {doctor.checks.length > 0 && (
            <div>
              <p className="doctor__label">What to check</p>
              <ul className="doctor__checks">
                {doctor.checks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {doctor.entries.some((e) => !e.inDocs) && (
            <p className="doctor__note">This error wording is not in Blotato's docs.</p>
          )}

          {canTrim && trim.status !== 'idle' && (
            <div className="doctor__trim">
              <label htmlFor="trim-text" className="doctor__label">
                Shorter caption for approval
              </label>
              {trim.status === 'writing' && <p>Claude is shortening the caption…</p>}
              {trim.status === 'error' && <p className="doctor__error">{trim.error}</p>}
              {trim.status === 'ready' && (
                <>
                  <textarea
                    id="trim-text"
                    className="doctor__textarea"
                    rows={5}
                    value={trim.text}
                    onChange={(e) => onTrimChange(e.target.value)}
                    aria-describedby="trim-count"
                    aria-invalid={trimOver}
                  />
                  <span id="trim-count" className={`doctor__count mono${trimOver ? ' doctor__count--over' : ''}`}>
                    {trimCount}/{BLUESKY_LIMIT}
                    {trimOver ? ` · ${trimCount - BLUESKY_LIMIT} over` : ''}
                  </span>
                </>
              )}
              <div className="doctor__actions">
                {trim.status === 'ready' && (
                  <button type="button" className="btn-mint" onClick={onTrimPost} disabled={sending || trimOver || !trim.text.trim()}>
                    {sending ? 'Posting…' : `Post this as a new ${post.dogName} post`}
                  </button>
                )}
                {trim.status === 'error' && (
                  <button type="button" className="btn-dark" onClick={onTrimStart}>
                    Try again
                  </button>
                )}
                <button type="button" className="btn-dark" onClick={onTrimCancel} disabled={sending}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <label htmlFor="doctor-reply" className="doctor__label">
            Reply to the customer
          </label>
          <textarea
            id="doctor-reply"
            className="doctor__textarea"
            rows={5}
            value={doctor.reply}
            onChange={(e) => onReplyChange(e.target.value)}
          />

          <div className="doctor__actions">
            {canTrim && trim.status === 'idle' && (
              <button type="button" className="btn-mint" onClick={onTrimStart} disabled={sending}>
                Trim and resend
              </button>
            )}
            <button type="button" className="btn-dark" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy reply'}
            </button>
            <button
              type="button"
              className="link-dark"
              aria-expanded={showRaw}
              aria-controls="doctor-raw"
              onClick={() => setShowRaw((v) => !v)}
            >
              {showRaw ? 'Hide raw response' : 'Raw response'}
            </button>
          </div>
          {showRaw && (
            <pre id="doctor-raw" className="doctor__raw mono" tabIndex={0}>
              {JSON.stringify(post.rawError ?? { note: 'No raw response was saved for this post.' }, null, 2)}
            </pre>
          )}

          {doctor.sources.length > 0 && (
            <div>
              <p className="doctor__label">From Blotato's docs</p>
              <ul className="doctor__sources">
                {doctor.sources.map((s) => (
                  <li key={s.url + s.title}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="doctor__meta mono">
            {doctor.model} · {new Date(doctor.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
        </>
      )}
    </div>
  )
}
