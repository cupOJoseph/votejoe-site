const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data", "manifest.json"), "utf8"));
const localToSource = new Map(manifest.images.map((image) => [image.local, image.source]));
const pageRe = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

function restoreValue(value) {
  if (typeof value === "string") {
    let restored = localToSource.get(value) || value;
    for (const [local, source] of localToSource) restored = restored.split(local).join(source);
    return restored;
  }
  if (Array.isArray(value)) return value.map(restoreValue);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = restoreValue(value[key]);
  }
  return value;
}

function escapeScriptJson(json) {
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function restorePage(file) {
  const html = fs.readFileSync(file, "utf8");
  const match = html.match(pageRe);
  if (!match) return;
  const data = restoreValue(JSON.parse(match[1]));
  const nextData = `<script id="__NEXT_DATA__" type="application/json">${escapeScriptJson(JSON.stringify(data))}</script>`;
  fs.writeFileSync(file, html.replace(pageRe, nextData));
}

for (const entry of fs.readdirSync(path.join(root, "pages"))) {
  const file = path.join(root, "pages", entry, "index.html");
  if (fs.existsSync(file)) restorePage(file);
}

const dataFile = path.join(root, "data", "next-data.json");
const data = restoreValue(JSON.parse(fs.readFileSync(dataFile, "utf8")));
fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
