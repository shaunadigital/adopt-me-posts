// Character counting, shared by the client (meter) and the server (caption route, fake Blotato).
// Keep this file free of Node-only and browser-only APIs.

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

/** What a person sees as one character. This is how Bluesky itself counts. */
export function countGraphemes(text: string): number {
  return [...segmenter.segment(text)].length
}

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u
// East Asian wide and full-width characters: Hangul Jamo, CJK, Hiragana/Katakana, Hangul syllables,
// CJK compatibility, full-width forms, and the supplementary ideograph planes.
const FULL_WIDTH =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3FFFD}]/u

/**
 * How Blotato counts toward its character limit (Error Reference, error code 20005):
 * "Emoji and full-width characters count as 2." Everything else counts as 1 per grapheme.
 * This is never lower than countGraphemes, so a caption that fits here fits Bluesky too.
 */
export function countForBlotato(text: string): number {
  let n = 0
  for (const { segment } of segmenter.segment(text)) n += EMOJI.test(segment) || FULL_WIDTH.test(segment) ? 2 : 1
  return n
}

export const BLUESKY_LIMIT = 300
