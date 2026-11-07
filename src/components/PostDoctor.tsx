import { useState, type ReactNode } from 'react'
import { STATUS_LABEL, TOO_LONG_IDS, type DoctorResult, type PostRecord } from '../lib/posts'
import { BLUESKY_LIMIT, countCaption } from '../lib/text'
import { TICKET_EXAMPLES, type TicketExample, type TicketLookup } from '../lib/tickets'

export interface TrimState {
  status: 'idle' | 'writing' | 'ready' | 'error'
  text: string
  error?: string
  ms?: number // how long Claude took, for the new post's trace
  http?: number
}

export interface TicketState {
  text: string
  /** Set while the text is an unedited example, so its saved result is used. */
  exampleKey: TicketExample['key'] | null
  status: 'idle' | 'working' | 'done' | 'error'
  doctor?: DoctorResult
  lookup?: TicketLookup | null
  error?: string
}

export type DoctorMode = 'post' | 'ticket'

interface Props {
  mode: DoctorMode
  onModeChange: (m: DoctorMode) => void
  // Selected post
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
  // Paste a ticket
  ticket: TicketState
  onTicketText: (text: string) => void
  onTicketExample: (ex: TicketExample) => void
  onTicketRun: () => void
  onTicketReply: (text: string) => void
  onShowPost: (postSubmissionId: string) => void
}

function DoctorIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="doctor__icon"
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

/** Cause, fix, checks, reply, copy, raw response and sources. Shared by both modes. */
function DoctorResultView({
  doctor,
  raw,
  rawLabel,
  onReplyChange,
  idPrefix,
  extraActions,
  beforeReply,
}: {
  doctor: DoctorResult
  raw: unknown
  rawLabel: string
  onReplyChange: (text: string) => void
  idPrefix: string
  extraActions?: ReactNode
  beforeReply?: ReactNode
}) {
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(doctor.reply)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      {!doctor.matched && (
        <p className="doctor__note">This isn't in the known errors list yet, so there are no doc links for it.</p>
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
      {doctor.entries.some((e) => !e.inDocs) && <p className="doctor__note">This error wording is not in Blotato's docs.</p>}

      {beforeReply}

      <label htmlFor={`${idPrefix}-reply`} className="doctor__label">
        Reply to the customer
      </label>
      <textarea
        id={`${idPrefix}-reply`}
        className="doctor__textarea"
        rows={6}
        value={doctor.reply}
        onChange={(e) => onReplyChange(e.target.value)}
      />

      <div className="doctor__actions">
        {extraActions}
        <button type="button" className="btn-dark" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy reply'}
        </button>
        <button
          type="button"
          className="link-dark"
          aria-expanded={showRaw}
          aria-controls={`${idPrefix}-raw`}
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Hide raw response' : 'Raw response'}
        </button>
      </div>
      {showRaw && (
        <div>
          <p className="doctor__label">{rawLabel}</p>
          <pre id={`${idPrefix}-raw`} className="doctor__raw mono" tabIndex={0}>
            {JSON.stringify(raw ?? { note: 'No raw response was saved.' }, null, 2)}
          </pre>
        </div>
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
        {doctor.model} ·{' '}
        {new Date(doctor.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </p>
    </>
  )
}

function SelectedPostView(props: Props) {
  const { post, loading, error, onRetry, onReplyChange, trim, sending, onTrimStart, onTrimChange, onTrimPost, onTrimCancel } = props
  const doctor = post?.doctor
  if (!post || post.status !== 'failed') {
    return <p>When a post fails, the cause, the fix and a reply you can send the customer show up here.</p>
  }

  const canTrim = !!doctor?.entries.some((e) => TOO_LONG_IDS.includes(e.id))
  const trimCount = countCaption(trim.text)
  const trimOver = trimCount > BLUESKY_LIMIT

  return (
    <>
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
        <DoctorResultView
          key={post.localId}
          doctor={doctor}
          raw={post.rawError}
          rawLabel="Saved error response"
          onReplyChange={onReplyChange}
          idPrefix="doctor"
          beforeReply={
            canTrim && trim.status !== 'idle' ? (
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
            ) : null
          }
          extraActions={
            canTrim && trim.status === 'idle' ? (
              <button type="button" className="btn-mint" onClick={onTrimStart} disabled={sending}>
                Trim and resend
              </button>
            ) : null
          }
        />
      )}
    </>
  )
}

function TicketView(props: Props) {
  const { ticket, onTicketText, onTicketExample, onTicketRun, onTicketReply, onShowPost } = props
  const working = ticket.status === 'working'
  const lookup = ticket.lookup

  return (
    <>
      <label htmlFor="ticket-text" className="doctor__label">
        What the customer wrote
      </label>
      <textarea
        id="ticket-text"
        className="doctor__textarea"
        rows={5}
        value={ticket.text}
        placeholder="Paste the customer's message. Include the post ID if they gave one."
        onChange={(e) => onTicketText(e.target.value)}
        disabled={working}
        aria-describedby="ticket-help"
      />
      <p id="ticket-help" className="doctor__hint">
        If it has a post ID, the doctor looks that post up first. The customer's words are only read as their question,
        never as instructions.
      </p>
      <div className="doctor__examples" role="group" aria-label="Try an example ticket">
        <span className="doctor__hint">Try an example:</span>
        {TICKET_EXAMPLES.map((ex) => (
          <button
            key={ex.key}
            type="button"
            className="chip-dark"
            aria-pressed={ticket.exampleKey === ex.key}
            onClick={() => onTicketExample(ex)}
            disabled={working}
          >
            {ex.label}
          </button>
        ))}
      </div>
      <div className="doctor__actions">
        <button type="button" className="btn-mint" onClick={onTicketRun} disabled={working || !ticket.text.trim()}>
          {working ? 'Reading the ticket…' : 'Diagnose ticket'}
        </button>
      </div>

      {ticket.status === 'error' && <p className="doctor__error">{ticket.error}</p>}

      {ticket.status === 'done' && ticket.doctor && (
        <>
          <div className="doctor__lookup">
            {lookup ? (
              <>
                <span>
                  Post <span className="mono">{lookup.postSubmissionId.slice(0, 12)}…</span>
                  {lookup.dogName ? ` (${lookup.dogName})` : ''}:{' '}
                  <strong>{lookup.liveStatus ? STATUS_LABEL[lookup.liveStatus] : (lookup.liveError ?? 'not found')}</strong>
                  {!lookup.savedHere && ' · no saved trace in this browser'}
                </span>
                {lookup.savedHere && (
                  <button type="button" className="link-dark" onClick={() => onShowPost(lookup.postSubmissionId)}>
                    Show this post
                  </button>
                )}
              </>
            ) : (
              <span>No post ID in the ticket.</span>
            )}
          </div>
          <DoctorResultView
            key={ticket.doctor.generatedAt}
            doctor={ticket.doctor}
            raw={lookup?.raw ?? null}
            rawLabel={lookup ? 'Blotato status response for that post' : 'No post was looked up'}
            onReplyChange={onTicketReply}
            idPrefix="ticket"
          />
        </>
      )}
    </>
  )
}

export function PostDoctor(props: Props) {
  const { mode, onModeChange, loading, ticket } = props
  return (
    <div className="doctor" aria-busy={loading || ticket.status === 'working'}>
      <div className="doctor__head">
        <DoctorIcon />
        <h3 className="doctor__title">Post doctor</h3>
        <a className="doctor__known" href="#known-errors">
          Known errors
        </a>
      </div>
      <div className="doctor__modes" role="group" aria-label="Post doctor mode">
        <button type="button" className="mode-dark" aria-pressed={mode === 'post'} onClick={() => onModeChange('post')}>
          Selected post
        </button>
        <button type="button" className="mode-dark" aria-pressed={mode === 'ticket'} onClick={() => onModeChange('ticket')}>
          Paste a ticket
        </button>
      </div>
      <div aria-live="polite" className="doctor__body">
        {mode === 'post' ? <SelectedPostView {...props} /> : <TicketView {...props} />}
      </div>
    </div>
  )
}
