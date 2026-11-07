// Character counting lives in shared/textCount.ts so the meter and the server agree.
// countCaption is what the app shows and enforces: Blotato's count (emoji and full-width = 2).
export { BLUESKY_LIMIT, countForBlotato as countCaption, countGraphemes } from '../../shared/textCount'
