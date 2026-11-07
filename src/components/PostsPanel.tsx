import { useState } from 'react'
import { STATUS_LABEL, formatWhen, shortId, type PostRecord, type PostStatus } from '../lib/posts'

type Filter = 'all' | 'failed' | 'scheduled'

const FILTER_MATCH: Record<Filter, (s: PostStatus) => boolean> = {
  all: () => true,
  failed: (s) => s === 'failed',
  scheduled: (s) => s === 'scheduled',
}

export function StatusPill({ status }: { status: PostStatus }) {
  return <span className={`pill pill--${status}`}>{STATUS_LABEL[status]}</span>
}

interface Props {
  posts: PostRecord[]
}

export function PostsPanel({ posts }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const count = (f: Filter) => posts.filter((p) => FILTER_MATCH[f](p.status)).length
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'failed', label: 'Failed' },
    { key: 'scheduled', label: 'Scheduled' },
  ]
  const shown = posts.filter((p) => FILTER_MATCH[filter](p.status))

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
              {f.label} {count(f.key)}
            </button>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="empty">
          <strong>No posts yet</strong>
          Posts you send or schedule will show here with their status.
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <strong>Nothing here</strong>
          No {filter} posts right now.
        </div>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Posts table, scrolls sideways on small screens">
          <table className="posts-table">
            <thead>
              <tr>
                <th scope="col">Dog</th>
                <th scope="col">Post</th>
                <th scope="col">When</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.localId} className={p.status === 'failed' ? 'row--failed' : undefined}>
                  <td className="cell-dog">{p.dogName}</td>
                  <td className="cell-post">
                    {p.postSubmissionId ? (
                      <span className="mono post-id" title={p.postSubmissionId}>
                        <span aria-hidden="true">{shortId(p.postSubmissionId)}</span>
                        <span className="visually-hidden">Post ID {p.postSubmissionId}</span>
                      </span>
                    ) : (
                      <span className="mono post-id muted">no ID</span>
                    )}
                    {p.error && <span className="row-error">{p.error}</span>}
                  </td>
                  <td className="cell-when">
                    {p.scheduledTime ? (
                      <>
                        {formatWhen(p.scheduledTime)}
                        <span className="cell-sub">set {formatWhen(p.createdAt)}</span>
                      </>
                    ) : (
                      formatWhen(p.createdAt)
                    )}
                  </td>
                  <td className="cell-status">
                    <StatusPill status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
