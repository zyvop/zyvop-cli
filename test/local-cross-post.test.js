import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { publishCommand } from "../src/commands/publish.js";
import {
  disableServerCrossPosting,
  resolveAllLocalCredentials,
} from "../src/local-cross-post.js";

test("local credentials are resolved from the supplied environment without persistence", () => {
  const credentials = resolveAllLocalCredentials(
    {
      devto: true,
      hashnode: false,
      medium: false,
      bluesky: true,
      wordpress: false,
    },
    {
      ZYVOP_DEVTO_API_KEY: "dev-secret",
      ZYVOP_BLUESKY_IDENTIFIER: "writer.bsky.social",
      ZYVOP_BLUESKY_APP_PASSWORD: "blue-secret",
    },
  );

  assert.deepEqual(credentials, {
    devto: { apiKey: "dev-secret" },
    bluesky: {
      identifier: "writer.bsky.social",
      appPassword: "blue-secret",
    },
  });
});

test("local mode removes every server-side cross-post request", () => {
  const input = matter.stringify("Body", {
    title: "Local article",
    cross_post: { devto: true, hashnode: true, medium: true },
    crossPostToDevTo: true,
  });
  const parsed = matter(disableServerCrossPosting(input));

  assert.deepEqual(parsed.data.cross_post, {
    devto: false,
    hashnode: false,
    medium: false,
    bluesky: false,
    wordpress: false,
  });
  assert.equal(parsed.data.crossPostToDevTo, false);
  assert.equal(parsed.data.crossPostToHashnode, false);
  assert.equal(parsed.data.crossPostToMedium, false);
  assert.equal(parsed.data.crossPostToBluesky, false);
  assert.equal(parsed.data.crossPostToWordpress, false);
  assert.equal(parsed.data.syndication_mode, "local");
});

test("publish --local sends the provider key only to the provider", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zyvop-local-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const article = path.join(directory, "article.md");
  fs.writeFileSync(
    article,
    `---
title: Local credential article
cross_post:
  devto: true
  hashnode: false
---
Body`,
    "utf8",
  );

  const originalFetch = global.fetch;
  const originalLog = console.log;
  const originalKey = process.env.ZYVOP_DEVTO_API_KEY;
  t.after(() => {
    global.fetch = originalFetch;
    console.log = originalLog;
    process.exitCode = undefined;
    if (originalKey === undefined) delete process.env.ZYVOP_DEVTO_API_KEY;
    else process.env.ZYVOP_DEVTO_API_KEY = originalKey;
  });
  console.log = () => {};
  process.env.ZYVOP_DEVTO_API_KEY = "provider-secret";

  const requests = [];
  global.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    if (url === "https://zyvop.com/api/v1/articles") {
      return {
        ok: true,
        json: async () => ({
          data: {
            id: "post-id",
            slug: "local-article",
            url: "https://zyvop.com/local-article",
          },
          action: "created",
        }),
      };
    }
    if (url.includes("/api/articles/me/all")) {
      return { ok: true, status: 200, text: async () => "[]" };
    }
    if (url === "https://dev.to/api/articles") {
      return {
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({ id: 42, url: "https://dev.to/test/article" }),
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  await publishCommand(article, {
    local: true,
    token: "zv_test",
    endpoint: "https://zyvop.com/graphql",
  });

  const zyvopRequest = requests.find(({ url }) =>
    url.includes("zyvop.com/api/v1/articles"),
  );
  const devToRequest = requests.find(
    ({ url }) => url === "https://dev.to/api/articles",
  );
  const submittedMarkdown = matter(JSON.parse(zyvopRequest.init.body).content);

  assert.equal(JSON.stringify(zyvopRequest).includes("provider-secret"), false);
  assert.equal(submittedMarkdown.data.cross_post.devto, false);
  assert.equal(devToRequest.init.headers["api-key"], "provider-secret");
  assert.equal(process.exitCode, undefined);
});
