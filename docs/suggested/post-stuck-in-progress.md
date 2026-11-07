> **Suggested draft, not an official Blotato article.** Written from Blotato's published docs (linked at the end) as a sample help-center article.

# My post says "in progress" for a long time. What should I do?

If a post keeps saying "in progress," here's what that status means and how to find out what happened.

## What "in progress" means

"In progress" means Blotato hasn't found a result for that post yet: it isn't published, failed or scheduled. Blotato also shows "in progress" when it has **no record of the post ID you asked about**. So a mistyped or wrong ID can look like a post that's stuck.

## What to do

1. **Check the post ID.** Use the ID you got back when you created the post (the `postSubmissionId`). A schedule ID or a published post's ID won't work here.
2. **Give it a little time.** If you're checking with the API or an automation, wait at least 10 seconds between checks, and stop after a set number of tries.
3. **Look at your posts.** In Blotato, check the Scheduled, Published and Failed lists for the same account and caption. If you find a failed post, read its error message; it tells you what to fix.
4. **Don't send it again yet.** Sending a replacement before you know what happened to the first one can post it twice.

## Still stuck?

Contact support with the post ID, the account you posted to, and the time you posted (with your time zone). Mention what you've already checked.

## Sources

- [Post lifecycle](https://help.blotato.com/api-and-mcp-concepts/post-lifecycle)
- [Async jobs and polling](https://help.blotato.com/api-and-mcp-concepts/async-jobs-and-polling)
- [Find a post's outcome before retrying](https://help.blotato.com/start-with-an-ai-agent/publishing-status)
- [Get Post Status](https://help.blotato.com/rest-api-reference/publish-post/get-post)
