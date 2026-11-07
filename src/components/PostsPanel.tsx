import { useState } from 'react'

type Filter = 'all' | 'failed' | 'scheduled'

// Empty state for now. Rows arrive once posting is wired up.
export function PostsPanel() {
  const [filter, setFilter] = useState<Filter>('all')
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All 0' },
    { key: 'failed', label: 'Failed 0' },
    { key: 'scheduled', label: 'Scheduled 0' },
  ]

  return (
    <section className="panel panel--grow" aria-labelledby="posts-title">
      <div className="panel__head">
        <h2 id="posts-title" className="section-title">
          All posts
        </h2>
        <div className="actions" role="group" aria-label="Filter posts">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className="btn btn--filter"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {/* The table (Dog, Post, When, Status) renders here once there are posts; it scrolls in .table-wrap on phones. */}
      <div className="empty">
        <strong>No posts yet</strong>
        Posts you send or schedule will show here with their status.
      </div>
    </section>
  )
}
