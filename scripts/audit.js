const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data", "manifest.json"), "utf8"));
const requiredRoutes = [
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

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

for (const route of requiredRoutes) {
  const file = `pages/${route || "index"}/index.html`;
  assert(exists(file), `Missing route HTML: ${file}`);
}

for (const ref of manifest.staticRefs) {
  assert(exists(`public${ref}`), `Missing static bundle: public${ref}`);
}

for (const image of [...manifest.images, ...manifest.nextImages]) {
  assert(exists(`public${image.local}`), `Missing local image: public${image.local}`);
}

const html = requiredRoutes
  .map((route) => fs.readFileSync(path.join(root, "pages", route || "index", "index.html"), "utf8"))
  .join("\n");
const htmlWithoutNextData = html.replace(
  /<script id="__NEXT_DATA__" type="application\/json">[\s\S]*?<\/script>/g,
  "",
);

assert(!htmlWithoutNextData.includes("https://run.imgix.net"), "Found live run.imgix.net image reference in rendered HTML.");
assert(
  !htmlWithoutNextData.includes("https://media.designedtorun.com"),
  "Found live media.designedtorun.com image reference in rendered HTML.",
);
assert(html.includes("/about"), "Homepage or shared HTML is missing /about link.");
assert(html.includes("/volunteer"), "Homepage or shared HTML is missing /volunteer link.");
assert(html.includes("/repair"), "Homepage or shared HTML is missing /repair link.");
assert(html.includes("/check"), "Homepage or shared HTML is missing /check link.");

assert(exists("component-library/index.html"), "Missing component library page.");
assert(exists("component-library/section-library.js"), "Missing reusable section-library.js.");
assert(exists("api/index.js"), "Missing Vercel serverless entrypoint.");
assert(exists("handler.js"), "Missing shared request handler.");
assert(exists("vercel.json"), "Missing Vercel rewrite configuration.");
assert(exists("public/img/site/pinstripes.png"), "Missing pinstripe texture asset.");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const handler = fs.readFileSync(path.join(root, "handler.js"), "utf8");
assert(handler.includes('pathname.startsWith("/_next/data/")'), "Handler is missing local Next data route support.");
assert(handler.includes('pathname === "/_next/image"'), "Handler is missing local Next image route support.");
assert(handler.includes('pathname.startsWith("/img/")'), "Handler is missing bundled /img asset route support.");
assert(handler.includes("imageFromManifest"), "Handler is missing manifest-backed image optimizer mapping.");
const library = fs.readFileSync(path.join(root, "component-library", "section-library.js"), "utf8");
for (const name of ["HeroSection", "FooterSection", "DonateSection", "GallerySection", "renderSection"]) {
  assert(library.includes(`function ${name}`) || library.includes(` ${name}(`), `Missing component export: ${name}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Audit passed: ${requiredRoutes.length} routes, ${manifest.staticRefs.length} static refs, ${
    manifest.images.length + manifest.nextImages.length
  } images, and component library files are present.`,
);
