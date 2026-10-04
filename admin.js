const crypto = require("crypto");

const PAGE_SIZE = 50;
const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
};

function respond(res, status, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(status, { ...PRIVATE_HEADERS, "content-type": contentType, ...headers });
  res.end(body);
}

function equalSecret(actual, expected) {
  const actualHash = crypto.createHash("sha256").update(actual).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

function authorized(req) {
  const header = req.headers.authorization || "";
  if (header.length > 4096 || !/^Basic [A-Za-z0-9+/=]+$/.test(header)) return false;
  const credentials = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = credentials.indexOf(":");
  if (separator < 0) return false;
  const username = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);
  return equalSecret(username, process.env.ADMIN_USERNAME || "admin") &&
    equalSecret(password, process.env.ADMIN_PASSWORD);
}

function adminPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>Email signups · VoteJoe admin</title>
  <link rel="stylesheet" href="/admin.css?v=2">
</head>
<body>
  <main class="admin-shell">
    <header class="admin-header">
      <p class="eyebrow">VoteJoe admin</p>
      <h1>Email signups</h1>
      <p>Subscriber email addresses and signup dates. Duplicate addresses appear once, with their most recent signup.</p>
    </header>
    <section class="admin-card" aria-label="Subscriber list">
      <div class="admin-toolbar">
        <p data-status role="status" aria-live="polite">Loading signups…</p>
        <button type="button" data-export disabled>Export CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Email</th><th scope="col">Most recent signup</th></tr></thead>
          <tbody data-signups></tbody>
        </table>
      </div>
      <p class="empty" data-empty hidden>No email signups found.</p>
    </section>
  </main>
  <script src="/admin.js?v=1" defer></script>
</body>
</html>`;
}

function decodeCursor(value) {
  if (!value) return { blob: null, blobDone: false, redisOffset: 0, redisDone: false };
  if (value.length > 4096) throw new Error("Invalid cursor");
  try {
    const state = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if ((state.blob !== null && (typeof state.blob !== "string" || state.blob.length > 3000)) ||
      typeof state.blobDone !== "boolean" ||
      !Number.isSafeInteger(state.redisOffset) || state.redisOffset < 0 || state.redisOffset > 100000000 ||
      typeof state.redisDone !== "boolean") throw new Error("Invalid cursor");
    return state;
  } catch {
    throw new Error("Invalid cursor");
  }
}

function normalizeRecord(record, fallbackDate) {
  if (!record || typeof record.email !== "string") throw new Error("Invalid signup record");
  const email = record.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid signup record");
  const timestamp = Date.parse(record.createdAt || "") || Date.parse(fallbackDate || "");
  return { email, createdAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null };
}

async function readBlobPage(cursor, blobClient) {
  const { get, list } = blobClient || await import("@vercel/blob");
  const result = await list({ prefix: "email-signups/", limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) });
  const items = [];
  for (let index = 0; index < result.blobs.length; index += 8) {
    const batch = await Promise.all(result.blobs.slice(index, index + 8).map(async (blob) => {
      const file = await get(blob.pathname, { access: "private" });
      if (!file || file.statusCode !== 200 || !file.stream) throw new Error("Could not read signup blob");
      const record = JSON.parse(await new Response(file.stream).text());
      return normalizeRecord(record, blob.uploadedAt);
    }));
    items.push(...batch);
  }
  if (result.hasMore && !result.cursor) throw new Error("Blob pagination failed");
  return { items, cursor: result.cursor || null, done: !result.hasMore };
}

async function redisPipeline(commands) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error("Could not read signup index");
  const results = await response.json();
  if (!Array.isArray(results) || results.length !== commands.length || results.some((item) => item.error)) {
    throw new Error("Could not read signup index");
  }
  return results.map((item) => item.result);
}

async function readRedisPage(offset) {
  const [ids] = await redisPipeline([["ZRANGE", "email_signups", offset, offset + PAGE_SIZE - 1]]);
  if (!Array.isArray(ids)) throw new Error("Invalid signup index");
  if (!ids.length) return { items: [], offset, done: true };
  const rows = await redisPipeline(ids.map((id) => ["HMGET", `email_signup:${id}`, "email", "createdAt"]));
  const items = rows.map((row) => {
    if (!Array.isArray(row) || row.length !== 2) throw new Error("Invalid signup record");
    return normalizeRecord({ email: row[0], createdAt: row[1] });
  });
  return { items, offset: offset + ids.length, done: ids.length < PAGE_SIZE };
}

async function readSignupPage(cursorValue, blobClient) {
  const state = decodeCursor(cursorValue);
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
  const hasRedis = Boolean((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
  if (!hasBlob && !hasRedis) {
    const error = new Error("Signup storage is not configured");
    error.statusCode = 503;
    throw error;
  }

  const items = [];
  if (hasBlob && !state.blobDone) {
    const page = await readBlobPage(state.blob, blobClient);
    items.push(...page.items);
    state.blob = page.cursor;
    state.blobDone = page.done;
  } else {
    state.blobDone = true;
  }
  if (hasRedis && !state.redisDone) {
    const page = await readRedisPage(state.redisOffset);
    items.push(...page.items);
    state.redisOffset = page.offset;
    state.redisDone = page.done;
  } else {
    state.redisDone = true;
  }
  return {
    items,
    nextCursor: state.blobDone && state.redisDone ? null : Buffer.from(JSON.stringify(state)).toString("base64url"),
  };
}

async function handleAdminRequest(req, res, pathname, url, loadPage = readSignupPage) {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16) {
    return respond(res, 503, "Admin access is not configured. Set a strong ADMIN_PASSWORD in Vercel.");
  }
  if (!authorized(req)) {
    return respond(res, 401, "Authentication required.", "text/plain; charset=utf-8", {
      "www-authenticate": 'Basic realm="votejoe-admin", charset="UTF-8"',
    });
  }
  if (req.method !== "GET") return respond(res, 405, "Method not allowed.", "text/plain; charset=utf-8", { allow: "GET" });
  if (pathname === "/admin" || pathname === "/admin/") {
    return respond(res, 200, adminPageHtml(), "text/html; charset=utf-8");
  }
  if (pathname === "/admin/api/signups") {
    try {
      const page = await loadPage(url.searchParams.get("cursor"));
      return respond(res, 200, JSON.stringify(page), "application/json; charset=utf-8");
    } catch (error) {
      const status = error.message === "Invalid cursor" ? 400 : error.statusCode || 502;
      return respond(res, status, JSON.stringify({ error: status === 400 ? "Invalid cursor." : "Could not load signups." }), "application/json; charset=utf-8");
    }
  }
  return respond(res, 404, "Not found.");
}

module.exports = { handleAdminRequest, readSignupPage };
