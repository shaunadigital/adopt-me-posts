import type { PostRecord, StepState, TraceStep } from '../lib/posts'
import { shortId } from '../lib/posts'
import { ExampleTag, StatusPill } from './PostsPanel'

// Shown when no post is selected.
const EMPTY_STEPS = [
  { label: 'Caption written', note: 'Claude writes it, you edit it' },
  { label: 'Photo uploaded', note: 'Sent to Blotato storage' },
  { label: 'Post sent to Blotato', note: 'Blotato queues it for Bluesky' },
  { label: 'Live on Bluesky', note: 'Or the reason it was rejected' },
]

const DOT: Record<StepState, { mark: string; label: string }> = {
  ok: { mark: '✓', label: 'Done' },
  failed: { mark: '!', label: 'Failed' },
  waiting: { mark: '', label: 'In progress' },
  scheduled: { mark: '', label: 'Scheduled' },
  skipped: { mark: '', label: 'Not reached' },
}

function Step({ step, last, demoMode }: { step: TraceStep; last: boolean; demoMode: boolean }) {
  const dot = DOT[step.state]
  return (
    <li className={`step step--${step.state}`}>
      <div className="step__rail" aria-hidden="true">
        <span className={`step__dot step__dot--${step.state}`}>{dot.mark}</span>
        {!last && <span className="step__line" />}
      </div>
      <div className="step__text">
        <div className="step__top">
          <span className="step__label">
            <span className="visually-hidden">{dot.label}: </span>
            {step.label}
          </span>
          {step.meta && <span className="step__meta mono">{step.meta}</span>}
        </div>
        <span className="step__note">
          {step.note}
          {/* Demo URLs are made up, so only link real posts. */}
          {step.link && !demoMode && (
            <>
              {' · '}
              <a href={step.link} target="_blank" rel="noreferrer">
                View on Bluesky
              </a>
            </>
          )}
        </span>
      </div>
    </li>
  )
}

function DoctorPlaceholder({ failed }: { failed: boolean }) {
  return (
    <div className="doctor">
      <div className="doctor__head">
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
        <h3 className="doctor__title">Post doctor</h3>
      </div>
      <p>
        {failed
          ? 'Coming next: the cause in plain words, the fix, and a reply you can send the customer.'
          : 'When a post fails, the cause, the fix and a reply you can send the customer show up here.'}
      </p>
    </div>
  )
}

interface Props {
  post: PostRecord | null
  demoMode: boolean
}

export function TracePanel({ post, demoMode }: Props) {
  if (!post) {
    return (
      <section className="panel trace" aria-labelledby="trace-title">
        <div className="panel__head">
          <h2 id="trace-title" className="section-title">
            Post trace
          </h2>
          <span className="muted" style={{ fontSize: 13 }}>
            No post selected
          </span>
        </div>
        <div className="trace__body">
          <p className="muted" style={{ margin: '0 0 16px' }}>
            Post a dog, or pick a row in All posts, to follow it through every step here.
          </p>
          <ol className="steps" aria-label="Steps a post goes through">
            {EMPTY_STEPS.map((s, i) => (
              <li key={s.label} className="step step--skipped">
                <div className="step__rail" aria-hidden="true">
                  <span className="step__dot step__dot--skipped" />
                  {i < EMPTY_STEPS.length - 1 && <span className="step__line" />}
                </div>
                <div className="step__text">
                  <span className="step__label">{s.label}</span>
                  <span className="step__note">{s.note}</span>
                </div>
              </li>
            ))}
          </ol>
          <DoctorPlaceholder failed={false} />
        </div>
      </section>
    )
  }

  return (
    <section className="panel trace" aria-labelledby="trace-title">
      <div className="panel__head">
        <h2 id="trace-title" className="section-title">
          Post trace: {post.dogName}
        </h2>
        {post.postSubmissionId && (
          <span className="mono trace__id" title={post.postSubmissionId}>
            {shortId(post.postSubmissionId)}
          </span>
        )}
        {post.example && <ExampleTag />}
        <span className="trace__pill">
          <StatusPill status={post.status} />
        </span>
      </div>
      <div className="trace__body">
        {post.trace.length === 0 ? (
          <p className="muted" style={{ margin: '0 0 16px' }}>
            This post was saved before traces were recorded.
          </p>
        ) : (
          <ol className="steps" aria-label={`Steps for ${post.dogName}'s post`} aria-live="polite">
            {post.trace.map((s, i) => (
              <Step key={s.key} step={s} last={i === post.trace.length - 1} demoMode={demoMode} />
            ))}
          </ol>
        )}
        <DoctorPlaceholder failed={post.status === 'failed'} />
      </div>
    </section>
  )
}
