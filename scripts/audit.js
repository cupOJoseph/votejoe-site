const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

const requiredFiles = [
  "api/index.js",
  "handler.js",
  "server.js",
  "vercel.json",
  "public/campaign-logo.png",
  "public/joe-header.jpg",
  "public/site.css",
  "public/site.js",
];

for (const file of requiredFiles) {
  assert(exists(file), `Missing required file: ${file}`);
}

for (const removedPath of ["pages", "data", "component-library", "public/_next", "public/assets", "public/img"]) {
  assert(!exists(removedPath), `Old site artifact still exists: ${removedPath}`);
}

const sourceFiles = requiredFiles.filter((file) => !file.endsWith(".jpg"));
const source = sourceFiles.map((file) => read(file)).join("\n");

assert(source.includes("/api/email-signups"), "Missing email signup API route.");
assert(source.includes("KV_REST_API_URL"), "Missing Vercel KV REST URL support.");
assert(source.includes("KV_REST_API_TOKEN"), "Missing Vercel KV REST token support.");
assert(source.includes("UPSTASH_REDIS_REST_URL"), "Missing Upstash REST URL fallback support.");
assert(source.includes("UPSTASH_REDIS_REST_TOKEN"), "Missing Upstash REST token fallback support.");
assert(source.includes("BLOB_STORE_ID"), "Missing Vercel Blob OIDC store support.");
assert(source.includes("BLOB_READ_WRITE_TOKEN"), "Missing Vercel Blob token support.");
assert(source.includes("@vercel/blob"), "Missing Vercel Blob SDK usage.");
assert(source.includes("email-signups/"), "Missing private email signup blob path.");
assert(source.includes("email_signup:"), "Missing durable signup hash write.");
assert(source.includes("email_signups"), "Missing signup index write.");
assert(source.includes("joe-header.jpg"), "Missing Joe header image reference.");
assert(source.includes("campaign-logo.png"), "Missing campaign logo reference.");

const forbidden = [
  "secure.actblue.com",
  "ActBlue",
  "Donate",
  "donate button",
  "Donate Crypto",
  "post-donate-share",
  "widget-button",
  "widget-script",
  "form.contributions.shift4payments",
  "mailto:",
  "run.imgix.net",
  "media.designedtorun.com",
];

for (const token of forbidden) {
  assert(!source.includes(token), `Forbidden legacy/donation token found: ${token}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Audit passed: ${requiredFiles.length} required files, no donation links, and durable email capture configured.`);
