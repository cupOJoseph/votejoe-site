const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = "https://www.votejoe.org";
const OUT = __dirname;
const nextDataRe = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
const routes = [
  "",
  "template",
  "about",
  "volunteer",
  "check",
  "repair",
  "crypto",
  "donate",
  "donate2",
  "issues",
  "events",
  "news",
];

for (const generatedDir of ["pages", "public", "data"]) {
  fs.rmSync(path.join(OUT, generatedDir), { recursive: true, force: true });
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function curl(url, outFile) {
  mkdirp(path.dirname(outFile));
  execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", url, "-o", outFile], {
    stdio: "inherit",
  });
}

function pageFile(route) {
  return path.join(OUT, "pages", route || "index", "index.html");
}

function normalizeHtml(html) {
  const nextDataScripts = [];
  return html
    .replace(nextDataRe, (script) => {
      const index = nextDataScripts.push(script) - 1;
      return `__NEXT_DATA_${index}__`;
    })
    .replace(/https:\/\/www\.votejoe\.org/g, "")
    .replace(/https:\/\/votejoe\.org/g, "")
    .replace(/__NEXT_DATA_(\d+)__/g, (_match, index) => nextDataScripts[Number(index)]);
}

for (const route of routes) {
  const url = `${ROOT}/${route}`;
  const outFile = pageFile(route);
  curl(url, outFile);
  fs.writeFileSync(outFile, normalizeHtml(fs.readFileSync(outFile, "utf8")));
}

const allHtml = routes.map((route) => fs.readFileSync(pageFile(route), "utf8")).join("\n");
const staticRefs = new Set();
for (const match of allHtml.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const ref = match[1].replace(/&amp;/g, "&");
  if (ref.startsWith("/_next/") && !ref.startsWith("/_next/image")) staticRefs.add(ref);
}

for (const ref of staticRefs) {
  curl(`${ROOT}${ref}`, path.join(OUT, "public", ref));
}

const extraStaticRefs = ["/img/site/pinstripes.png"];

for (const ref of extraStaticRefs) {
  curl(`${ROOT}${ref}`, path.join(OUT, "public", ref));
}

const imageUrls = new Map();
let imageIndex = 1;
const nextImageUrls = new Map();
let nextImageIndex = 1;
const imageRe = /https:\/\/(?:run\.imgix\.net|media\.designedtorun\.com)[^"' <>)\\]+/g;

function imageExtFromUrl(rawUrl) {
  try {
    const u = new URL(rawUrl, ROOT);
    const nested = u.searchParams.get("url");
    const sourcePath = nested ? new URL(nested).pathname : u.pathname;
    return path.extname(sourcePath).split("?")[0] || ".jpg";
  } catch {
    return ".jpg";
  }
}

function localForImage(url) {
  if (!imageUrls.has(url)) {
    const noQuery = new URL(url).pathname;
    const ext = path.extname(noQuery).split("?")[0] || ".img";
    const name = `image-${String(imageIndex++).padStart(2, "0")}${ext}`;
    imageUrls.set(url, `/assets/images/${name}`);
  }
  return imageUrls.get(url);
}

function localForNextImage(ref) {
  const url = ref.replace(/&amp;/g, "&");
  if (!nextImageUrls.has(url)) {
    const ext = imageExtFromUrl(url);
    const name = `next-image-${String(nextImageIndex++).padStart(2, "0")}${ext}`;
    nextImageUrls.set(url, `/assets/images/${name}`);
  }
  return nextImageUrls.get(url);
}

function escapeScriptJson(json) {
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function rewriteValue(value) {
  if (typeof value === "string") {
    return value
      .replace(/\/_next\/image\?[^"' <>)]+/g, (ref) => localForNextImage(ref))
      .replace(imageRe, (raw) => localForImage(raw.replace(/&amp;/g, "&")));
  }
  if (Array.isArray(value)) return value.map(rewriteValue);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = rewriteValue(value[key]);
  }
  return value;
}

for (const route of routes) {
  const file = pageFile(route);
  let html = fs.readFileSync(file, "utf8");
  let nextData = null;
  html = html.replace(nextDataRe, (_full, data) => {
    nextData = JSON.parse(data);
    rewriteValue(JSON.parse(JSON.stringify(nextData)));
    return "__NEXT_DATA_PLACEHOLDER__";
  });
  html = html
    .replace(/\/_next\/image\?[^"' <>)]+/g, (ref) => localForNextImage(ref))
    .replace(imageRe, (raw) => localForImage(raw.replace(/&amp;/g, "&")));
  if (nextData) {
    html = html.replace(
      "__NEXT_DATA_PLACEHOLDER__",
      `<script id="__NEXT_DATA__" type="application/json">${escapeScriptJson(JSON.stringify(nextData))}</script>`,
    );
  }
  fs.writeFileSync(file, html);
}

for (const [url, local] of imageUrls) {
  curl(url, path.join(OUT, "public", local));
}

for (const [url, local] of nextImageUrls) {
  curl(`${ROOT}${url}`, path.join(OUT, "public", local));
}

const dataMatch = fs
  .readFileSync(pageFile(""), "utf8")
  .match(nextDataRe);
if (dataMatch) {
  mkdirp(path.join(OUT, "data"));
  fs.writeFileSync(path.join(OUT, "data", "next-data.json"), JSON.stringify(JSON.parse(dataMatch[1]), null, 2));
}

fs.writeFileSync(
  path.join(OUT, "data", "manifest.json"),
  JSON.stringify(
    {
      root: ROOT,
      fetchedAt: new Date().toISOString(),
      routes,
      staticRefs: [...staticRefs],
      extraStaticRefs,
      images: [...imageUrls.entries()].map(([source, local]) => ({ source, local })),
      nextImages: [...nextImageUrls.entries()].map(([source, local]) => ({ source, local })),
    },
    null,
    2,
  ),
);

console.log(`Fetched ${routes.length} pages, ${staticRefs.size} static refs, ${imageUrls.size} images.`);
