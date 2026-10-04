const assert = require("node:assert/strict");
const test = require("node:test");
const { handleAdminRequest, readSignupPage } = require("../admin");

const savedEnvironment = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  BLOB_STORE_ID: process.env.BLOB_STORE_ID,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};

function request(pathname, authorization, loadPage = async () => ({ items: [], nextCursor: null })) {
  return new Promise((resolve) => {
    let status;
    let headers;
    const res = {
      writeHead(code, values) { status = code; headers = values; },
      end(body) { resolve({ status, headers, body }); },
    };
    const req = { method: "GET", headers: authorization ? { authorization } : {} };
    handleAdminRequest(req, res, pathname, new URL(pathname, "https://votejoe.org"), loadPage);
  });
}

test("admin stays disabled without a strong password", async () => {
  delete process.env.ADMIN_PASSWORD;
  const result = await request("/admin");
  assert.equal(result.status, 503);
  assert.equal(result.headers["cache-control"], "private, no-store");
});

test("admin page and signup API both require the password", async () => {
  process.env.ADMIN_PASSWORD = "test-only-long-password";
  const unauthorized = await request("/admin/api/signups");
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers["www-authenticate"], /Basic/);

  const credentials = `Basic ${Buffer.from("admin:test-only-long-password").toString("base64")}`;
  const page = await request("/admin", credentials);
  assert.equal(page.status, 200);
  assert.match(page.body, /Email signups/);
  assert.equal(page.headers["cache-control"], "private, no-store");

  const api = await request("/admin/api/signups", credentials, async () => ({
    items: [{ email: "person@example.org", createdAt: "2026-10-04T12:00:00.000Z" }],
    nextCursor: null,
  }));
  assert.equal(api.status, 200);
  assert.deepEqual(JSON.parse(api.body).items.map((item) => item.email), ["person@example.org"]);
  assert.equal(api.headers["cache-control"], "private, no-store");
});

test("Redis signups are read through the stored index", async () => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  process.env.KV_REST_API_URL = "https://example.test";
  process.env.KV_REST_API_TOKEN = "test-token";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (_url, options) => {
    const commands = JSON.parse(options.body);
    calls.push(commands);
    const result = calls.length === 1
      ? [{ result: ["one"] }]
      : [{ result: ["person@example.org", "2026-10-04T12:00:00.000Z"] }];
    return { ok: true, json: async () => result };
  };
  try {
    const page = await readSignupPage(null);
    assert.deepEqual(page.items, [{ email: "person@example.org", createdAt: "2026-10-04T12:00:00.000Z" }]);
    assert.equal(page.nextCursor, null);
    assert.deepEqual(calls[0], [["ZRANGE", "email_signups", 0, 49]]);
    assert.deepEqual(calls[1], [["HMGET", "email_signup:one", "email", "createdAt"]]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("private Blob signups paginate without exposing Blob URLs", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
  delete process.env.BLOB_STORE_ID;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const seen = [];
  const client = {
    list: async ({ prefix, cursor }) => {
      assert.equal(prefix, "email-signups/");
      return cursor
        ? { blobs: [{ pathname: "email-signups/second.json", uploadedAt: "2026-10-04T12:01:00Z" }], hasMore: false }
        : { blobs: [{ pathname: "email-signups/first.json", uploadedAt: "2026-10-04T12:00:00Z" }], cursor: "next", hasMore: true };
    },
    get: async (pathname, options) => {
      seen.push([pathname, options.access]);
      const email = pathname.includes("first") ? "FIRST@example.org" : "second@example.org";
      return { statusCode: 200, stream: new Response(JSON.stringify({ email })).body };
    },
  };
  const first = await readSignupPage(null, client);
  assert.deepEqual(first.items.map((item) => item.email), ["first@example.org"]);
  assert.ok(first.nextCursor);
  const second = await readSignupPage(first.nextCursor, client);
  assert.deepEqual(second.items.map((item) => item.email), ["second@example.org"]);
  assert.equal(second.nextCursor, null);
  assert.deepEqual(seen, [
    ["email-signups/first.json", "private"],
    ["email-signups/second.json", "private"],
  ]);
});

test.after(() => {
  for (const [name, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
