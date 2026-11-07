import { useEffect, useState } from 'react'

function App() {
  // Default to demo mode until the server says otherwise.
  const [demoMode, setDemoMode] = useState(true)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { demoMode?: boolean } | null) => {
        if (data && typeof data.demoMode === 'boolean') setDemoMode(data.demoMode)
      })
      .catch(() => {})
  }, [])

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '64px 16px', textAlign: 'center' }}>
      {demoMode && (
        <span
          style={{
            display: 'inline-block',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.5,
            padding: '4px 10px',
            borderRadius: 999,
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fcd34d',
          }}
        >
          Demo mode
        </span>
      )}
      <h1 style={{ margin: '16px 0 8px' }}>Adopt Me Posts</h1>
      <p style={{ color: '#6b7280', margin: 0 }}>Social posts for rescue dogs. Coming soon.</p>
    </main>
  )
}

export default App
