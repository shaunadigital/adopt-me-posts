> **Suggested draft, not an official Blotato article.** Written from Blotato's published docs (linked at the end) as a sample help-center article.

# Why did my Bluesky post fail when it looked under 300 characters?

Bluesky posts can be up to 300 characters. Sometimes a post that looks shorter than that still fails with a message like:

> Text length exceeds the character limit of 300 characters for platform bluesky (error code 20005)

## Why this happens

When Blotato checks the length, **emoji and full-width characters count as 2**.

So a caption that your phone or text editor counts as 280 characters can count as more than 300 if it has several emoji. For example, 20 dog emoji add 40 to the count, not 20.

## How to fix it

1. Remove a few emoji, or swap them for words.
2. Shorten the text so it's comfortably under 300, especially if you like to use emoji.
3. If you're posting a thread, check each post in the thread too. The error details name any thread post that's too long.
4. Send the post again.

This error is only about the length of the text, so that's the only thing to change.

## Tip

If you write captions in another tool, count emoji twice when you check the length. That way you'll know the post fits before you send it.

## Sources

- [Error Reference: Plan Limit Errors (error code 20005)](https://help.blotato.com/support/errors)
- [Media Requirements: Bluesky (300 characters per post)](https://help.blotato.com/rest-api-reference/publish-post/media)
- [Bluesky API and MCP](https://help.blotato.com/platform-publishing/platforms/bluesky)
