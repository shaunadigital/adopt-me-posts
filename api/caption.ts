// POST /api/caption  { dogSlug, previous?, trimFrom? } → { caption, characters, model, ms }
// trimFrom: shorten that caption under 280 characters (post doctor's "Trim and resend").
// Claude writes a Bluesky caption for one dog. `previous` is the current caption, sent by
// "Rewrite with Claude" so the new one takes a different angle.
import Anthropic from '@anthropic-ai/sdk'
import { RESCUE_NAME, findDog } from '../shared/dogs.js'
import { countForBlotato } from '../shared/textCount.js'
import { json, readJson } from './_lib/http.js'
import { rateLimited } from './_lib/rateLimit.js'

const MODEL = 'claude-sonnet-5-5'
const LIMIT = 300

const SYSTEM = `You write adoption posts for ${RESCUE_NAME}, a small dog rescue, on Bluesky.

Write one caption for the dog described by the user. Rules:
- Under 280 characters, so it fits Bluesky's 300 with room to spare.
- Warm and specific: use one or two concrete details about this dog, not general praise.
- Plain words, the way a foster volunteer talks. No exclamation-mark pileups.
- No emoji. No hashtags, except at most one at the very end if it reads naturally.
- End with a simple next step, such as asking people to message the rescue to meet the dog.
- Don't invent facts beyond what you're given, and don't name a website, phone number or date.

Reply with the caption text only, no quotes and no preamble.`

const EMOJI = /\p{Extended_Pictographic}️?/gu

function clean(text: string): string {
  return text
    .replace(EMOJI, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

let client: Anthropic | null = null

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return json(503, { message: 'Caption writing is not set up: ANTHROPIC_API_KEY is missing on the server.' })
  }
  if (rateLimited(req, 'caption', 12)) return json(429, { message: 'Too many captions in a minute. Wait a moment and try again.' })

  const body = await readJson(req)
  if (body instanceof Response) return body
  const dog = typeof body.dogSlug === 'string' ? findDog(body.dogSlug) : undefined
  if (!dog) return json(400, { message: 'Unknown dog.' })
  const previous = typeof body.previous === 'string' ? body.previous.slice(0, 600).trim() : ''
  // "Trim and resend" from the post doctor: shorten this exact caption instead of writing a new one.
  const trimFrom = typeof body.trimFrom === 'string' ? body.trimFrom.slice(0, 1200).trim() : ''

  const pronoun = dog.sex === 'female' ? 'she/her' : 'he/him'
  let prompt = `Dog: ${dog.name} (${pronoun}), ${dog.age} years old, ${dog.breed}, ${dog.size}.
What the foster says:
${dog.facts.map((f) => `- ${f}`).join('\n')}`
  if (trimFrom) {
    prompt += `\n\nThis caption was too long for Bluesky (${countForBlotato(trimFrom)} characters as Blotato counts them, where emoji and full-width characters count as 2; limit 300). Shorten it to under 280 characters. Keep its voice, its facts and its closing next step, cut words rather than changing the meaning, and add nothing new:\n${trimFrom}`
  } else if (previous) {
    prompt += `\n\nThe current caption is below. Write a fresh one with a different opening and a different detail up front:\n${previous}`
  }

  client ??= new Anthropic()
  const started = Date.now()
  try {
    let caption = ''
    // One retry if the first draft runs long.
    for (let attempt = 0; attempt < 2; attempt++) {
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }]
      if (attempt === 1) {
        messages[0] = {
          role: 'user',
          content: `${prompt}\n\nYour last draft was ${countForBlotato(caption)} characters. Keep this one under 260.`,
        }
      }
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        messages,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      })
      if (res.stop_reason === 'refusal') {
        console.log(JSON.stringify({ caption: 'refusal', dog: dog.slug, category: res.stop_details?.category ?? null }))
        return json(502, { message: 'Claude declined to write this caption. Try again or write it by hand.' })
      }
      caption = clean(
        res.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
      )
      console.log(
        JSON.stringify({
          caption: 'done',
          dog: dog.slug,
          attempt,
          model: res.model,
          characters: countForBlotato(caption),
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
        }),
      )
      if (caption && countForBlotato(caption) <= LIMIT) break
    }
    if (!caption) return json(502, { message: 'Claude returned an empty caption. Try again.' })
    return json(200, { caption, characters: countForBlotato(caption), model: MODEL, ms: Date.now() - started })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('caption: Anthropic rejected the API key')
      return json(502, { message: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.' })
    }
    if (e instanceof Anthropic.RateLimitError) {
      return json(429, { message: 'Claude is rate limited right now. Try again in a minute.' })
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`caption: Anthropic API error ${e.status}: ${e.message}`)
      return json(502, { message: `Claude API error ${e.status ?? ''}. Try again.`.replace('  ', ' ') })
    }
    console.error('caption: unexpected error', e)
    return json(500, { message: 'Something went wrong writing the caption.' })
  }
}
