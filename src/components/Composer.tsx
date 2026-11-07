import { RESCUE_NAME, type Dog } from '../../shared/dogs'
import { BLUESKY_LIMIT, countGraphemes } from '../lib/text'

interface Props {
  dog: Dog
  caption: string
  loading: boolean
  error: string | null
  handle: string | null
  onChange: (text: string) => void
  onRewrite: () => void
}

export function Composer({ dog, caption, loading, error, handle, onChange, onRewrite }: Props) {
  const count = countGraphemes(caption)
  const over = count > BLUESKY_LIMIT
  const pct = Math.min(100, (count / BLUESKY_LIMIT) * 100)
  const countText = over ? `${count}/${BLUESKY_LIMIT} · ${count - BLUESKY_LIMIT} over` : `${count}/${BLUESKY_LIMIT}`

  return (
    <section className="panel" aria-labelledby="compose-title">
      <div className="panel__head">
        <h2 id="compose-title" className="section-title">
          Write {dog.name}'s post
        </h2>
        <div className="actions">
          <button type="button" className="btn" onClick={onRewrite} disabled={loading}>
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
            disabled={loading}
            aria-busy={loading}
            aria-invalid={over}
            aria-describedby="caption-count"
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
        <label htmlFor="when" style={{ fontWeight: 500 }}>
          Send
        </label>
        <select id="when" className="select" defaultValue="now">
          <option value="now">Now</option>
          <option value="monday">Monday 9:00 AM</option>
          <option value="pick">Pick a time</option>
        </select>
        <span className="muted" style={{ fontSize: 13 }}>
          to Bluesky
        </span>
        <button
          type="button"
          className="btn btn--primary"
          disabled
          aria-describedby="post-soon"
        >
          Post {dog.name}
        </button>
        <span id="post-soon" className="visually-hidden">
          Posting is not wired up yet.
        </span>
      </div>
    </section>
  )
}
