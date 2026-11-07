> **Suggested draft, not an official Blotato article.** Written from Blotato's published docs (linked at the end) as a sample help-center article. Blotato's API guide shows this message on a failed post but doesn't explain it, so this draft relies on the closest documented case, an account connection that needs refreshing.

# What does "Invalid account credentials" mean, and how do I reconnect?

If a post fails with **"Invalid account credentials,"** Blotato couldn't use the connection to your social account when it tried to publish. The usual fix is to refresh that connection.

Social platforms ask you to refresh connections to tools like Blotato from time to time. This is normal and helps keep your account secure.

## How to reconnect (Bluesky example)

1. Go to [Accounts](https://my.blotato.com/accounts) in Blotato.
2. Find the account in the list.
3. Open its actions menu, choose **Reconnect**, and approve with the same account.

**Use Reconnect, not Disconnect.** Disconnecting an account makes every post scheduled for it fail.

## After you reconnect

- **If you use the API or an automation,** look up your accounts again before sending the post. A saved account ID from before the reconnect might be out of date.
- **Send the post again.** Before you do, check your posts to make sure the first one didn't go out, so it isn't posted twice.

## Still failing?

If the same error comes back after a fresh reconnect, contact support with the post ID, the account and the exact error message. Never include passwords or API keys.

## Sources

- [API reference for agents: example of a failed post with this message](https://help.blotato.com/start-with-an-ai-agent/llm)
- [Error Reference: Connection Errors, "Account requires reconnect"](https://help.blotato.com/support/errors)
- [Connect Bluesky: How to Refresh Bluesky Connection](https://help.blotato.com/social-accounts-and-platform-faqs/bluesky/connect-accounts)
- [Accounts and identifiers](https://help.blotato.com/api-and-mcp-concepts/accounts-and-identifiers)
- [Find a post's outcome before retrying](https://help.blotato.com/start-with-an-ai-agent/publishing-status)
