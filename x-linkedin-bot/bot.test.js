"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { run, readState } = require("./bot");

function mockResponse(data, status = 200, headers = {}) {
  return new Response(data === null ? "" : JSON.stringify(data), { status, headers });
}

function fixture(posts, { decision = true, failPublish = false } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    const parsed = new URL(url);
    calls.push({ host: parsed.hostname, options });
    if (parsed.hostname === "api.x.com") {
      const since = parsed.searchParams.get("since_id");
      return mockResponse({ data: posts.filter((post) => !since || BigInt(post.id) > BigInt(since)), meta: {} });
    }
    if (parsed.hostname === "api.openai.com") return mockResponse({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ share: decision, reason: "professional topic" }) }] }] });
    if (failPublish) throw new Error("Network timeout");
    return mockResponse(null, 201, { "x-restli-id": "urn:li:share:123" });
  };
  return { calls, fetcher };
}

async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "crosspost-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const policyFile = path.join(dir, "policy.txt");
  await fs.writeFile(policyFile, "Share professional topics only.");
  return { stateFile: path.join(dir, "state.json"), policyFile, xUserId: "123", xToken: "x", openaiKey: "o", model: "gpt-4.1-mini", linkedinToken: "l", linkedinPersonUrn: "urn:li:person:123", linkedinVersion: "202610" };
}

test("an empty first run initializes and a later post is published exactly once", async (t) => {
  const cfg = await setup(t);
  await run(cfg, { fetcher: fixture([]).fetcher, log() {} });
  assert.equal((await readState(cfg.stateFile)).initialized, true);
  const post = { id: "100", text: "A useful lesson from my project." };
  const mock = fixture([post]);
  await run(cfg, { fetcher: mock.fetcher, log() {} });
  const publish = mock.calls.find((call) => call.host === "api.linkedin.com");
  assert.equal(JSON.parse(publish.options.body).commentary, post.text);
  assert.equal((await readState(cfg.stateFile)).cursor, "100");
  const rerun = fixture([post]);
  await run(cfg, { fetcher: rerun.fetcher, log() {} });
  assert.equal(rerun.calls.filter((call) => call.host === "api.linkedin.com").length, 0);
});

test("replies are skipped without publishing", async (t) => {
  const cfg = await setup(t);
  await run(cfg, { fetcher: fixture([]).fetcher, log() {} });
  const mock = fixture([{ id: "200", text: "Reply", referenced_tweets: [{ type: "replied_to", id: "199" }] }]);
  await run(cfg, { fetcher: mock.fetcher, log() {} });
  assert.equal(mock.calls.some((call) => call.host === "api.openai.com"), false);
  assert.equal((await readState(cfg.stateFile)).history[0].decision, "skip");
});

test("uncertain publication stops future runs to avoid duplicates", async (t) => {
  const cfg = await setup(t);
  await run(cfg, { fetcher: fixture([]).fetcher, log() {} });
  const mock = fixture([{ id: "300", text: "Project update" }], { failPublish: true });
  await assert.rejects(run(cfg, { fetcher: mock.fetcher, log() {} }), /Network timeout/);
  assert.equal((await readState(cfg.stateFile)).pending.xId, "300");
  await assert.rejects(run(cfg, { fetcher: fixture([]).fetcher, log() {} }), /outcome.*uncertain/);
});
