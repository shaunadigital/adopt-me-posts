// Public app config. Never returns key values, only whether demo mode is on.
// Demo mode: BLOTATO_API_KEY is empty, so Blotato calls return fake responses.
export function GET() {
  const demoMode = !process.env.BLOTATO_API_KEY?.trim()
  return Response.json({ demoMode })
}
