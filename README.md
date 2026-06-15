# votejoe.org

A small campaign update site for `votejoe.org`.

The public site is intentionally only:

- a header photo of Joe
- social links
- the campaign suspension letter
- an email signup form

There are no donation links, ActBlue buttons, crypto widgets, or old campaign pages.

## Run locally

```sh
npm start
```

The server starts at `http://localhost:4173` and uses the next open port if needed.

## Email storage

The signup form posts to `POST /api/email-signups`.

In production, signups are saved to the connected Vercel Blob store when this env var is present:

```sh
BLOB_READ_WRITE_TOKEN
```

Each signup is written as a private JSON blob under `email-signups/`.

The endpoint also supports Vercel KV or Upstash Redis through the REST API. Configure one of these env var pairs on the Vercel project to use Redis instead of Blob:

```sh
KV_REST_API_URL
KV_REST_API_TOKEN
```

or:

```sh
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

When Redis is configured, the endpoint writes each signup to:

- `email_signup:<sha256(email)>` as a Redis hash containing email, createdAt, ip, userAgent, and referrer
- `email_signups` as a sorted set of signup IDs scored by timestamp

If storage is not configured, the endpoint returns `503` and the UI shows an error. It does not pretend an email was saved.

## Verify

```sh
npm run audit
```
