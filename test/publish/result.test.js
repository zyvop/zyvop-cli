import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { publishCommand } from "../../src/commands/publish.js";

const scenarios = [
  {
    name: "developer-token draft creation",
    token: "zv_test",
    draft: true,
    status: "DRAFT",
  },
  {
    name: "developer-token draft update",
    token: "zv_test",
    draft: true,
    status: "DRAFT",
    update: true,
  },
  {
    name: "password-session draft creation",
    token: "jwt-test",
    draft: true,
    status: "DRAFT",
  },
  {
    name: "password-session preserved draft update",
    token: "jwt-test",
    status: "DRAFT",
    update: true,
  },
  {
    name: "local draft",
    token: "zv_test",
    draft: true,
    status: "DRAFT",
    local: true,
  },
  { name: "scheduled article", token: "zv_test", status: "SCHEDULED" },
  { name: "published article", token: "zv_test", status: "PUBLISHED" },
  {
    name: "published update",
    token: "jwt-test",
    status: "PUBLISHED",
    update: true,
  },
];

for (const scenario of scenarios) {
  test(`${scenario.name} reports its saved status and correct destination`, async (t) => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "zyvop-cli-result-"),
    );
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const article = path.join(directory, "article.md");
    fs.writeFileSync(
      article,
      `---
title: Testing ZyVOP CLI
${scenario.update ? "id: post-id\n" : ""}ai_disclosure: human_written
${scenario.status === "SCHEDULED" ? "status: SCHEDULED\n" : ""}---
Body`,
    );

    const post = {
      id: "post-id",
      slug: "testing-zyvop-cli-qk6i1",
      status: scenario.status,
      url: "https://zyvop.com/testing-zyvop-cli-qk6i1",
    };
    const output = [];
    const requests = [];
    t.mock.method(console, "log", (...args) => output.push(args.join(" ")));
    t.mock.method(process.stderr, "write", (chunk) => {
      output.push(String(chunk));
      return true;
    });
    t.mock.method(globalThis, "fetch", async (url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      let response;
      if (String(url).endsWith("/api/v1/articles")) {
        response = {
          action: scenario.update ? "updated" : "created",
          data: post,
        };
      } else if (body.query.includes("GetMyPost(")) {
        response = { data: { getMyPost: post } };
      } else if (body.query.includes("CreatePost(")) {
        response = { data: { createPost: post } };
      } else if (body.query.includes("UpdatePost(")) {
        response = { data: { updatePost: post } };
      } else {
        response = { data: { myIntegrations: {} } };
      }
      return { ok: true, json: async () => response };
    });

    await publishCommand(article, {
      token: scenario.token,
      endpoint: "https://zyvop.com/graphql",
      draft: scenario.draft,
      local: scenario.local,
    });

    const text = output.join("\n");
    if (scenario.status === "PUBLISHED") {
      assert.match(
        text,
        scenario.update
          ? /Article updated successfully/
          : /Article published successfully/,
      );
      assert.match(
        text,
        /ZyVOP Live URL:\s+https:\/\/zyvop.com\/testing-zyvop-cli-qk6i1(?:\s|$)/,
      );
      assert.doesNotMatch(text, /ZyVOP Editor URL/);
    } else {
      assert.match(
        text,
        scenario.status === "DRAFT"
          ? /Draft saved successfully/
          : /Article scheduled successfully/,
      );
      assert.match(
        text,
        /ZyVOP Editor URL:\s+https:\/\/zyvop.com\/testing-zyvop-cli-qk6i1\/edit/,
      );
      assert.doesNotMatch(
        text,
        /Article published successfully|ZyVOP Live URL|Queued & Synced|Missing API key/,
      );
      assert.equal(
        requests.some((body) => body.query?.includes("MyIntegrations")),
        false,
      );
      if (scenario.update && scenario.token === "jwt-test") {
        const update = requests.find((body) =>
          body.query?.includes("UpdatePost("),
        );
        assert.equal(update.variables.input.status, undefined);
      }
    }
  });
}
