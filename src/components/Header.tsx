import { RESCUE_NAME } from '../../shared/dogs'

interface Props {
  demoMode: boolean
  handle: string | null
}

export function Header({ demoMode, handle }: Props) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <h1 className="wordmark">Adopt Me Posts</h1>
        <span className="site-header__org">for {RESCUE_NAME}</span>
        <div className="site-header__right">
          {demoMode && (
            <span className="badge-demo" title="Blotato calls return fake responses until a real API key is added">
              Demo mode · fake Blotato
            </span>
          )}
          {handle && (
            <span className="account-chip">
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
                <circle cx="4" cy="4" r="4" fill="#5FD1B3" />
              </svg>
              <span className="visually-hidden">Connected Bluesky account: </span>@{handle}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
