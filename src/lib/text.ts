// Bluesky counts graphemes (what a person sees as one character), not UTF-16 units.
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

export function countGraphemes(text: string): number {
  return [...segmenter.segment(text)].length
}

export const BLUESKY_LIMIT = 300
