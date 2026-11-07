// GET /api/dogs: the six dogs with their starter captions and public photo URLs, plus this week's
// "Dog of the week" for the n8n workflow (n8n/dog-of-the-week.json). Static data, no Claude, no Blotato.
//
// Rotation: the dogs go in order (Mochi, Biscuit, Rocket, Pepper, Pip, Tank), one per week, starting
// Monday 2026-11-09. Weeks run Monday to Sunday in Hawaii time (UTC-10, no daylight saving).
// ?date=YYYY-MM-DD previews the dog for the week containing that date.
import { DOGS } from '../shared/dogs.js'
import { json } from './_lib/http.js'

const HAWAII_OFFSET_MS = -10 * 3600_000
const ANCHOR_MONDAY_UTC = Date.UTC(2026, 10, 9) // 2026-11-09, a Monday
const WEEK_MS = 7 * 86_400_000

/** Week number since the anchor Monday, counted in Hawaii time. */
function weekIndex(at: number): number {
  const hawaiiMidnight = (t: number) => {
    const d = new Date(t + HAWAII_OFFSET_MS)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  return Math.floor((hawaiiMidnight(at) - ANCHOR_MONDAY_UTC) / WEEK_MS)
}

export function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin
  const dateParam = url.searchParams.get('date')
  let at = Date.now()
  if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return json(400, { message: 'Use ?date=YYYY-MM-DD.' })
    at = Date.parse(`${dateParam}T12:00:00-10:00`) // midday in Hawaii on that date
  }

  const dogs = DOGS.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    caption: d.starterCaption,
    photoUrl: `${origin}${d.photo}`,
    photoAlt: d.photoAlt,
  }))
  const week = weekIndex(at)
  const index = ((week % dogs.length) + dogs.length) % dogs.length

  return Response.json(
    {
      dogOfTheWeek: dogs[index],
      rotation: { order: dogs.map((d) => d.name), weekStarting: '2026-11-09', timeZone: 'Pacific/Honolulu', week, index },
      dogs,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
