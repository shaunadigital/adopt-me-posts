// Empty state for now. Once posting is wired up this shows each step of a post and the post doctor.
const STEPS = [
  { label: 'Caption written', note: 'Claude writes it, you edit it' },
  { label: 'Photo uploaded', note: 'Sent to Blotato storage' },
  { label: 'Post sent to Blotato', note: 'Blotato queues it for Bluesky' },
  { label: 'Live on Bluesky', note: 'Or the reason it was rejected' },
]

export function TracePanel() {
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
          Post a dog to follow it through every step here.
        </p>
        <ol className="steps" aria-label="Steps a post goes through">
          {STEPS.map((s, i) => (
            <li key={s.label} className="step">
              <div className="step__rail" aria-hidden="true">
                <span className="step__dot" />
                {i < STEPS.length - 1 && <span className="step__line" />}
              </div>
              <div className="step__text">
                <span className="step__label">{s.label}</span>
                <span className="step__note">{s.note}</span>
              </div>
            </li>
          ))}
        </ol>
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
          <p>When a post fails, the cause, the fix and a reply you can send the customer show up here.</p>
        </div>
      </div>
    </section>
  )
}
