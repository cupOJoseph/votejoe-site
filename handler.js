const fs = require("fs");
const path = require("path");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

const closedDonationRoutes = new Set(["donate", "donate2"]);

function campaignShutdownOverlay() {
  return `
<div id="campaign-suspension-overlay" class="campaign-suspension-overlay" role="dialog" aria-modal="true" aria-labelledby="campaign-suspension-title">
  <div class="campaign-suspension-dialog">
    <button class="campaign-suspension-close" type="button" aria-label="Close campaign update">Close</button>
    <p class="campaign-suspension-kicker">Campaign Update</p>
    <h2 id="campaign-suspension-title">Thank you for being part of this movement.</h2>
    <div class="campaign-suspension-letter">
      <p>Thank you to the hundreds of people who donated, volunteered, and joined this movement.</p>
      <p>This campaign was always bigger than me or any one person. It was part of a larger fight for environmental sustainability, accountable government, and leadership that treats the housing crisis with the urgency our communities deserve.</p>
      <p>Due to the Supreme Court's decision to throw out the district I was running in, overturning the will of the people and the millions of Virginians who voted under the new maps, I am suspending my campaign indefinitely.</p>
      <p>Every dollar we raised will be returned to donors. As other candidates use campaign funds to advance themselves, remember this: our campaign raised a competitive amount, and we are returning it all.</p>
      <p>Thank you. I will never stop organizing and working toward a future we can be proud of.</p>
      <p class="campaign-suspension-signature">Joe Schiarizzi</p>
    </div>
    <form class="campaign-email-form">
      <label for="campaign-email">Stay involved</label>
      <div class="campaign-email-row">
        <input id="campaign-email" name="email" type="email" autocomplete="email" placeholder="Email address" required/>
        <button type="submit">Join email list</button>
      </div>
      <p class="campaign-email-status" role="status" aria-live="polite"></p>
    </form>
    <div class="campaign-suspension-actions">
      <button class="campaign-suspension-secondary" type="button">Continue to site</button>
    </div>
  </div>
</div>`;
}

function transformPageHtml(html) {
  let transformed = html;

  if (!transformed.includes("/campaign-shutdown.css")) {
    transformed = transformed.replace("</head>", '<link rel="stylesheet" href="/campaign-shutdown.css"/></head>');
  }

  if (!transformed.includes("campaign-suspension-overlay")) {
    transformed = transformed.replace(
      "</body>",
      `${campaignShutdownOverlay()}<script src="/campaign-shutdown.js" defer></script></body>`,
    );
  }

  return transformed;
}

function safeJoin(base, requestPath) {
  const resolved = path.resolve(base, `.${requestPath}`);
  return resolved.startsWith(base) ? resolved : null;
}

function send(res, file) {
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(file);
    const contentType = mime[ext] || "application/octet-stream";
    const responseBody = ext === ".html" ? Buffer.from(transformPageHtml(body.toString("utf8")), "utf8") : body;
    res.writeHead(200, { "content-type": contentType });
    res.end(responseBody);
  });
}

function pageData(root, route) {
  const file = path.join(root, "pages", route || "index", "index.html");
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, "utf8");
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  return match ? match[1] : null;
}

function imageFromManifest(root, source) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "data", "manifest.json"), "utf8"));
    const match = [...manifest.images, ...manifest.nextImages].find((image) => image.source === source);
    return match ? match.local : null;
  } catch {
    return null;
  }
}

function handleRequest(req, res, root = __dirname) {
  const url = new URL(req.url, "http://localhost");
  let pathname = url.pathname;

  if (pathname === "/") return send(res, path.join(root, "pages", "index", "index.html"));
  const route = pathname.replace(/^\/+|\/+$/g, "");
  if (closedDonationRoutes.has(route)) {
    res.writeHead(302, { location: "/" });
    res.end();
    return;
  }

  if (pathname === "/component-library") pathname = "/component-library/";
  if (pathname === "/component-library/") return send(res, path.join(root, "component-library", "index.html"));

  if (pathname.startsWith("/_next/data/")) {
    const fileName = pathname.split("/").pop() || "index.json";
    const routeName = fileName.replace(/\.json$/, "");
    const data = pageData(root, routeName === "index" ? "" : routeName);
    if (!data) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(data);
    return;
  }

  if (pathname === "/_next/image") {
    const imagePath = url.searchParams.get("url") || "";
    if (imagePath.startsWith("/assets/")) {
      const file = safeJoin(path.join(root, "public"), imagePath);
      return file ? send(res, file) : (res.writeHead(403), res.end("Forbidden"));
    }
    const localImage = imageFromManifest(root, imagePath);
    if (localImage) {
      const file = safeJoin(path.join(root, "public"), localImage);
      return file ? send(res, file) : (res.writeHead(403), res.end("Forbidden"));
    }
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/img/") ||
    pathname === "/campaign-shutdown.css" ||
    pathname === "/campaign-shutdown.js"
  ) {
    const file = safeJoin(path.join(root, "public"), pathname);
    return file ? send(res, file) : (res.writeHead(403), res.end("Forbidden"));
  }

  if (pathname.startsWith("/data/") || pathname.startsWith("/component-library/")) {
    const file = safeJoin(root, pathname);
    return file ? send(res, file) : (res.writeHead(403), res.end("Forbidden"));
  }

  const page = path.join(root, "pages", route, "index.html");
  if (fs.existsSync(page)) return send(res, page);

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

module.exports = { handleRequest };
