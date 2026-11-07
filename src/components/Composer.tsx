import { useEffect, useMemo, useState } from 'react'
import { RESCUE_NAME, type Dog } from '../../shared/dogs'
import { localTimeZoneLabel, nextMonday9am, toLocalInputValue, type SendOption } from '../lib/posts'
import { BLUESKY_LIMIT, countCaption } from '../lib/text'

interface Props {
  dog: Dog
  caption: string
  loading: boolean
  error: string | null
  handle: string | null
  accountReady: boolean
  sending: boolean
  sendStatus: string | null
  onChange: (text: string) => void
  onRewrite: () => void
  /** scheduledTime is ISO 8601 UTC, or undefined to post now. */
  onPost: (scheduledTime?: string) => void
}

export function Composer(props: Props) {
  const { dog, caption, loading, error, handle, accountReady, sending, sendStatus, onChange, onRewrite, onPost } = props
  const count = countCaption(caption)
  const over = count > BLUESKY_LIMIT
  const pct = Math.min(100, (count / BLUESKY_LIMIT) * 100)
  const countText = over ? `${count}/${BLUESKY_LIMIT} · ${count - BLUESKY_LIMIT} over` : `${count}/${BLUESKY_LIMIT}`

  const [sendOption, setSendOption] = useState<SendOption>('now')
  const [pickValue, setPickValue] = useState('')
  const [now, setNow] = useState(() => new Date())
  // Keep "Monday 9:00 AM" and the picker's minimum current if the page stays open.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const monday = useMemo(() => nextMonday9am(now), [now])
  const mondayLabel = monday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const tzLabel = useMemo(() => localTimeZoneLabel(), [])

  // datetime-local gives local wall time; new Date() reads it in the viewer's zone.
  const picked = pickValue ? new Date(pickValue) : null
  const pickError =
    sendOption !== 'pick'
      ? null
      : !picked || Number.isNaN(picked.getTime())
        ? 'Choose a date and time.'
        : picked.getTime() <= now.getTime() + 60_000
          ? 'Choose a time in the future.'
          : null

  const blockedReason = sending
    ? null
    : loading
      ? 'Wait for the caption to finish.'
      : !caption.trim()
        ? 'Write a caption first.'
        : over
          ? `Trim ${count - BLUESKY_LIMIT} characters to post.`
          : !accountReady
            ? 'No Bluesky account is connected.'
            : pickError
  const disabled = sending || !!blockedReason

  function handlePost() {
    if (disabled) return
    if (sendOption === 'now') onPost(undefined)
    else if (sendOption === 'monday') onPost(monday.toISOString())
    else if (picked) onPost(picked.toISOString())
  }

  const verb = sendOption === 'now' ? 'Post' : 'Schedule'

  return (
    <section className="panel" aria-labelledby="compose-title">
      <div className="panel__head">
        <h2 id="compose-title" className="section-title">
          Write {dog.name}'s post
        </h2>
        <div className="actions">
          <button type="button" className="btn" onClick={onRewrite} disabled={loading || sending}>
            {loading ? 'Claude is writing…' : caption ? 'Rewrite with Claude' : 'Write with Claude'}
          </button>
        </div>
      </div>

      <div className="composer__body">
        <div className="composer__edit">
          <label htmlFor="caption" className="composer__label">
            Bluesky caption
          </label>
          <textarea
            id="caption"
            className="composer__textarea"
            rows={8}
            value={loading ? '' : caption}
            placeholder={loading ? `Claude is writing ${dog.name}'s caption…` : `Write a caption for ${dog.name}.`}
            onChange={(e) => onChange(e.target.value)}
            disabled={loading || sending}
            aria-busy={loading}
            aria-invalid={over}
            aria-describedby="caption-count caption-count-note"
          />
          <div className="meter">
            <div className="meter__track" aria-hidden="true">
              <div className={`meter__fill${over ? ' meter__fill--over' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <span id="caption-count" className={`meter__count${over ? ' meter__count--over' : ''}`}>
              <span className="visually-hidden">Characters used: </span>
              {countText}
            </span>
          </div>
          <p id="caption-count-note" className="meter__note">
            Counted the way Blotato does: emoji and full-width characters count as 2.
          </p>
          {over && !loading && (
            <p className="inline-error">Bluesky stops at {BLUESKY_LIMIT} characters. Trim {count - BLUESKY_LIMIT} to post.</p>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="composer__preview">
          <span className="composer__label">How it will look</span>
          <article className="bsky" aria-label="Bluesky preview">
            <div className="bsky__author">
              <span className="bsky__avatar" aria-hidden="true">
                OS
              </span>
              <span className="bsky__names">
                <span className="bsky__name">{RESCUE_NAME}</span>
                <span className="bsky__handle">@{handle ?? 'adoptmeposts.bsky.social'}</span>
              </span>
            </div>
            <p className={`bsky__text${caption && !loading ? '' : ' bsky__text--empty'}`}>
              {loading ? 'Writing…' : caption || 'Your caption shows here.'}
            </p>
            <img className="bsky__photo" src={dog.photo} alt={dog.photoAlt} />
          </article>
        </div>
      </div>

      <div className="composer__foot">
        <div className="send">
          <label htmlFor="when" className="send__label">
            Send
          </label>
          <select
            id="when"
            className="select"
            value={sendOption}
            onChange={(e) => {
              const v = e.target.value as SendOption
              setSendOption(v)
              if (v === 'pick' && !pickValue) {
                // Start the picker one hour from now, on the hour.
                const d = new Date(now.getTime() + 60 * 60_000)
                d.setMinutes(0, 0, 0)
                setPickValue(toLocalInputValue(d))
              }
            }}
            disabled={sending}
          >
            <option value="now">Now</option>
            <option value="monday">Monday 9:00 AM ({mondayLabel})</option>
            <option value="pick">Pick a time</option>
          </select>
          {sendOption === 'pick' && (
            <span className="send__pick">
              <label htmlFor="when-pick" className="visually-hidden">
                Date and time, in {tzLabel}
              </label>
              <input
                id="when-pick"
                type="datetime-local"
                className="select"
                value={pickValue}
                min={toLocalInputValue(now)}
                onChange={(e) => setPickValue(e.target.value)}
                disabled={sending}
                aria-invalid={!!pickError}
                aria-describedby="when-tz"
              />
            </span>
          )}
          <span id="when-tz" className="muted send__note">
            to Bluesky{sendOption !== 'now' && <>, in your time zone: {tzLabel}</>}
          </span>
        </div>
        <button type="button" className="btn btn--primary send__button" onClick={handlePost} disabled={disabled} aria-describedby="send-status">
          {sending ? `${verb === 'Post' ? 'Posting' : 'Scheduling'} ${dog.name}…` : `${verb} ${dog.name}`}
        </button>
        <p id="send-status" className={`send__status${blockedReason ? ' send__status--blocked' : ''}`} role="status" aria-live="polite">
          {sending ? 'Uploading the photo, then sending the post to Blotato…' : (blockedReason ?? sendStatus ?? '')}
        </p>
      </div>
    </section>
  )
}
