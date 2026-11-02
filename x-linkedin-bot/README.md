# X → LinkedIn bot

Polls your X posts, decides whether each text post fits your LinkedIn policy, and copies approved posts verbatim to your personal LinkedIn profile. Replies, reposts, quotes, media, and polls are recorded as skips because a text copy would lose context. Decisions are logged locally. No LinkedIn review step is needed for normal operation.

## Setup

1. Create an X developer app with read access to your posts. Get its bearer token and your numeric X user ID.
2. Create a LinkedIn developer app, add **Share on LinkedIn**, and authorize your member account for `w_member_social`. Get a member access token. To find your person ID, use LinkedIn OpenID Connect and its `userinfo` `sub` value, then set `urn:li:person:{sub}`. Tokens expire, so renew the token when LinkedIn rejects it.
3. Get an OpenAI API key.
4. Copy `.env.example` to a private environment file outside the repo, fill the values, and load it in your shell or scheduler. Node 22+ is required; no npm packages are needed.
5. Edit `policy.txt` to match what you consider appropriate. Start with `node x-linkedin-bot/bot.js --dry-run` to check that X access works. The first normal run sets a baseline at your newest post; it does not publish old posts. Subsequent runs review new posts.
6. Run `node x-linkedin-bot/bot.js` on a schedule, for example every 10 minutes. Keep `BOT_STATE_FILE` on persistent disk and ensure only one run happens at a time. The process exits with an error if an API call fails, so your scheduler should alert you on failures.

`state.json` contains the last processed X ID and recent decisions. If a LinkedIn request times out or fails after it might have been accepted, the bot stops with a `pending` ID to prevent a duplicate. Check whether that X post appeared on LinkedIn, then remove `pending` from the state file and set `cursor` to that X ID if it did; if it did not, remove `pending` and leave `cursor` unchanged to retry.

The bot currently copies text only. It does not sync edits or deletions after publishing. X API access, LinkedIn access, and OpenAI usage may incur charges or require periodic token renewal.

## API references

- [X API user posts example](https://github.com/xdevplatform/samples/blob/main/python/users/timeline/get_posts.py)
- [X API pagination](https://docs.x.com/xdks/python/pagination)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [LinkedIn member posting permission](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
