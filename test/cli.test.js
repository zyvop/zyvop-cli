import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { publishCommand } from "../src/commands/publish.js";

test("dry-run succeeds without contacting the configured endpoint", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zyvop-cli-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const article = path.join(directory, "article.md");
  fs.writeFileSync(
    article,
    "---\ntitle: Offline preview\ncover_image: ./cover.webp\n---\nBody",
    "utf8",
  );

  const result = spawnSync(
    process.execPath,
    [
      "bin/zyvop.js",
      "publish",
      article,
      "--dry-run",
      "--base-url",
      "https://example.com/blog/",
      "--endpoint",
      "http://127.0.0.1:1/graphql",
    ],
    {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
      env: { ...process.env, ZYVOP_TOKEN: "" },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Local validation only/);
  assert.match(result.stdout, /https:\/\/example\.com\/blog\/cover\.webp/);
});

test("password-session publishing updates a post identified by zyvop_id", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zyvop-cli-upsert-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const article = path.join(directory, "article.md");
  const postId = "00000000-0000-4000-8000-000000000001";
  fs.writeFileSync(
    article,
    `---\ntitle: Existing article\nzyvop_id: ${postId}\n---\nUpdated body`,
    "utf8",
  );

  const originalFetch = global.fetch;
  const originalLog = console.log;
  t.after(() => {
    global.fetch = originalFetch;
    console.log = originalLog;
  });
  console.log = () => {};

  const operations = [];
  global.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    operations.push(request);
    if (request.query.includes("GetMyPost(")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            getMyPost: {
              id: postId,
              slug: "existing-article",
              status: "DRAFT",
            },
          },
        }),
      };
    }
    if (request.query.includes("UpdatePost(")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            updatePost: {
              id: postId,
              slug: "existing-article",
              status: "DRAFT",
            },
          },
        }),
      };
    }
    return { ok: true, json: async () => ({ data: { myIntegrations: {} } }) };
  };

  await publishCommand(article, {
    token: "jwt-test-token",
    endpoint: "https://zyvop.com/graphql",
  });

  assert.equal(
    operations.some(({ query }) => query.includes("CreatePost(")),
    false,
  );
  const update = operations.find(({ query }) => query.includes("UpdatePost("));
  assert.equal(update.variables.input.id, postId);
  assert.equal(update.variables.input.status, undefined);
});
