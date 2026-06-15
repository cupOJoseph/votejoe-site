const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const mime = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const socialLinks = [
  ["facebook", "Facebook", "https://facebook.com/votejoeva", "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3.6l.4-4h-4V7a1 1 0 0 1 1-1h3z"],
  ["instagram", "Instagram", "https://instagram.com/votejoe", "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.5A4.5 4.5 0 1 0 12 16.5 4.5 4.5 0 0 0 12 7.5zm5.5-.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 9.6A2.4 2.4 0 1 1 12 14.4 2.4 2.4 0 0 1 12 9.6z"],
  ["x", "X", "https://x.com/va_joe", "M18.9 2h3.2l-7 8 8.2 12h-6.4l-5-7.3L6 22H2.8l7.5-8.6L2.4 2H9l4.5 6.6zM17.8 20h1.8L8 3.9H6.1z"],
  ["linkedin", "LinkedIn", "https://linkedin.com/in/joseph-schiarizzi/", "M6.9 8.9H3.2V21h3.7zM5 3a2.1 2.1 0 1 0 0 4.2A2.1 2.1 0 0 0 5 3zm16 18h-3.7v-5.9c0-1.4 0-3.2-1.9-3.2s-2.2 1.5-2.2 3.1v6H9.5V8.9H13v1.7h.1a3.8 3.8 0 0 1 3.4-1.9c3.7 0 4.4 2.4 4.4 5.6z"],
  ["tiktok", "TikTok", "https://tiktok.com/@vote_joe", "M16 3c.3 2.6 1.8 4.2 4.4 4.4v3.4a8.2 8.2 0 0 1-4.3-1.2v6.5a6 6 0 1 1-6-6c.4 0 .8 0 1.2.1v3.6a2.5 2.5 0 1 0 1.4 2.3V3z"],
  ["threads", "Threads", "https://threads.net/@votejoe", "M12.2 2C6.2 2 2.7 5.9 2.7 12.1c0 6.2 3.5 9.9 9.5 9.9 5.4 0 8.8-2.8 8.8-7.2 0-3.1-1.9-5.2-5.2-6-.4-2.5-1.7-3.8-3.8-3.8-1.8 0-3.2.8-4 2.2l2.5 1.7c.4-.7.9-1.1 1.7-1.1 1 0 1.6.6 1.8 1.8a12 12 0 0 0-2.2 0c-2.8.2-4.5 1.6-4.4 3.7.1 2 1.8 3.3 4.2 3.2 2.1-.1 3.5-1.1 4.1-3 .9.6 1.4 1.4 1.4 2.4 0 2.1-1.9 3.4-5 3.4-4 0-6.2-2.7-6.2-7.2 0-4.6 2.2-7.3 6.2-7.3 2.4 0 4.2 1 5.3 3.1l2.8-1.5C18.6 3.5 15.9 2 12.2 2zm.2 10.1c.7 0 1.3 0 1.8.2-.2 1.2-.8 1.8-2.2 1.9-1 .1-1.7-.4-1.7-1.1 0-.6.6-.9 2.1-1z"],
  ["bluesky", "Bluesky", "https://bsky.app/profile/votejoe.bsky.social", "M5.5 4.4C8 6.3 10.7 10 12 12c1.3-2 4-5.7 6.5-7.6 1.8-1.4 4.8-2.4 4.8 1 0 .7-.4 5.7-.6 6.5-.8 2.8-3.7 3.6-6.3 3.1 4.5.8 5.7 3.3 3.2 5.9-4.7 4.8-6.8-1.2-7.4-2.8l-.2-.6-.2.6c-.6 1.6-2.7 7.6-7.4 2.8-2.5-2.6-1.3-5.1 3.2-5.9-2.6.5-5.5-.3-6.3-3.1C1 11.1.7 6.1.7 5.4c0-3.4 3-2.4 4.8-1z"],
];

function iconPath(pathData) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${pathData}"></path></svg>`;
}

function socialIcons() {
  return socialLinks
    .map(([key, label, href, pathData]) => {
      return `<a class="social-link social-link-${key}" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${iconPath(pathData)}</a>`;
    })
    .join("");
}

function pageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Joe Schiarizzi</title>
  <meta name="description" content="A campaign update from Joe Schiarizzi.">
  <meta property="og:title" content="Joe Schiarizzi">
  <meta property="og:description" content="A campaign update from Joe Schiarizzi.">
  <meta property="og:image" content="/joe-header.jpg">
  <link rel="stylesheet" href="/site.css">
</head>
<body>
  <main class="site-shell">
    <header class="hero" aria-label="Joe Schiarizzi">
      <img src="/joe-header.jpg" alt="Joe Schiarizzi standing in front of a colorful mural">
    </header>

    <section class="content" aria-labelledby="letter-title">
      <nav class="socials" aria-label="Social links">${socialIcons()}</nav>

      <article class="letter">
        <p class="kicker">Campaign update</p>
        <h1 id="letter-title">Thank you for being part of this movement.</h1>
        <p>Thank you to the hundreds of people who donated, volunteered, and joined this movement.</p>
        <p>This campaign was always bigger than me or any one person. It was part of a larger fight for environmental sustainability, accountable government, and leadership that treats the housing crisis with the urgency our communities deserve.</p>
        <p>Due to the Supreme Court's decision to throw out the district I was running in, overturning the will of the people and the millions of Virginians who voted under the new maps, I am suspending my campaign indefinitely.</p>
        <p>Every dollar we raised will be returned to donors. As other candidates use campaign funds to advance themselves, remember this: our campaign raised a competitive amount, and we are returning it all.</p>
        <p>Thank you. I will never stop organizing and working toward a future we can be proud of.</p>
        <p class="signature">Joe Schiarizzi</p>

        <form class="email-form" data-email-form>
          <label for="email">Stay in touch</label>
          <div class="email-row">
            <input id="email" name="email" type="email" autocomplete="email" placeholder="Email address" required>
            <button type="submit">Join email list</button>
          </div>
          <p class="form-status" data-form-status role="status" aria-live="polite"></p>
        </form>
      </article>
    </section>
  </main>
  <script src="/site.js" defer></script>
</body>
</html>`;
}

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(statusCode, {
    "content-type": contentType,
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(body);
}

function sendFile(res, file) {
  fs.readFile(file, (err, body) => {
    if (err) return send(res, 404, "Not found");
    send(res, 200, body, mime[path.extname(file)] || "application/octet-stream", {
      "cache-control": path.basename(file) === "joe-header.jpg" ? "public, max-age=31536000, immutable" : "public, max-age=300",
    });
  });
}

function safeJoin(base, requestPath) {
  const resolved = path.resolve(base, `.${requestPath}`);
  return resolved.startsWith(base) ? resolved : null;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8192) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function saveEmailSignup(email, req) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const err = new Error("Email storage is not configured.");
    err.statusCode = 503;
    throw err;
  }

  const timestamp = new Date().toISOString();
  const id = crypto.createHash("sha256").update(email).digest("hex");
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
  const userAgent = req.headers["user-agent"] || "";
  const referrer = req.headers.referer || "";

  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      ["HSET", `email_signup:${id}`, "email", email, "createdAt", timestamp, "ip", ip, "userAgent", userAgent, "referrer", referrer],
      ["ZADD", "email_signups", Date.now(), id],
    ]),
  });

  if (!response.ok) {
    const err = new Error("Email storage request failed.");
    err.statusCode = 502;
    throw err;
  }
}

async function handleEmailSignup(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, { allow: "POST", "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
    return;
  }

  try {
    let body;
    try {
      body = JSON.parse(await readRequestBody(req) || "{}");
    } catch {
      return send(res, 400, JSON.stringify({ ok: false, error: "Invalid request body." }), "application/json; charset=utf-8", {
        "cache-control": "no-store",
      });
    }

    const email = normalizeEmail(body.email);
    if (!isEmail(email)) return send(res, 400, JSON.stringify({ ok: false, error: "Enter a valid email address." }), "application/json; charset=utf-8");

    await saveEmailSignup(email, req);
    send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8", {
      "cache-control": "no-store",
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = statusCode === 503 ? "Email storage is not configured yet." : "Could not save this email right now.";
    send(res, statusCode, JSON.stringify({ ok: false, error: message }), "application/json; charset=utf-8", {
      "cache-control": "no-store",
    });
  }
}

function handleRequest(req, res, root = __dirname) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/api/email-signups") {
    handleEmailSignup(req, res);
    return;
  }

  if (pathname === "/site.css" || pathname === "/site.js" || pathname === "/joe-header.jpg") {
    const file = safeJoin(path.join(root, "public"), pathname);
    return file ? sendFile(res, file) : send(res, 403, "Forbidden");
  }

  send(res, 200, pageHtml(), "text/html; charset=utf-8");
}

module.exports = { handleRequest };
