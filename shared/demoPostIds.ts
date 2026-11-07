// Demo-mode post IDs. Used by the fake Blotato (api/_lib/demo.ts) and by the client's example posts.
// Serverless functions don't share memory, so a demo post's whole life is encoded in its ID:
//   demo-<created base36>-<scheduled base36 or 0>-<outcome>-<random 8 hex>
//   outcome: ok | dis (disconnected account) | media (bad media URL) | long<N> (text N characters long)
// Any server instance can then work out the current status from the ID and the clock.
// Keep this file free of Node-only and browser-only APIs (globalThis.crypto exists in both).

export const DEMO_ID_RE = /^demo-([0-9a-z]+)-([0-9a-z]+)-(ok|dis|media|long\d+)-([0-9a-f]{8})$/

export type DemoOutcome = 'ok' | 'dis' | 'media' | `long${number}`

export function encodeDemoPostId(created: number, scheduled: number | null, outcome: DemoOutcome): string {
  const rand = globalThis.crypto.randomUUID().slice(0, 8)
  return `demo-${created.toString(36)}-${scheduled ? scheduled.toString(36) : '0'}-${outcome}-${rand}`
}
