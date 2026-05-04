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

function safeJoin(base, requestPath) {
  const resolved = path.resolve(base, `.${decodeURIComponent(requestPath)}`);
  return resolved.startsWith(base) ? resolved : null;
}

function send(res, file) {
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  });
}

function pageData(root, route) {
  const file = path.join(root, "pages", route || "index", "index.html");
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, "utf8");
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  return match ? match[1] : null;
}

function handleRequest(req, res, root = __dirname) {
  const url = new URL(req.url, "http://localhost");
  let pathname = url.pathname;

  if (pathname === "/") return send(res, path.join(root, "pages", "index", "index.html"));
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
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (pathname.startsWith("/_next/") || pathname.startsWith("/assets/")) {
    const file = safeJoin(path.join(root, "public"), pathname);
    return file ? send(res, file) : (res.writeHead(403), res.end("Forbidden"));
  }

  if (pathname.startsWith("/data/") || pathname.startsWith("/component-library/")) {
    const file = safeJoin(root, pathname);
    return file ? send(res, file) : (res.writeHead(403), res.end("Forbidden"));
  }

  const route = pathname.replace(/^\/+|\/+$/g, "");
  const page = path.join(root, "pages", route, "index.html");
  if (fs.existsSync(page)) return send(res, page);

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

module.exports = { handleRequest };
