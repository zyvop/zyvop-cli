import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPublishPayload } from "../../src/publish-payload.js";
import {
  parseFrontmatter,
  stringifyFrontmatter,
} from "../../src/frontmatter.js";
import { disableServerCrossPosting } from "../../src/local-cross-post.js";
import { publishCommand } from "../../src/commands/publish.js";

const metadata = {
  title: "Two LinkedIn audiences",
  status: "DRAFT",
  cross_post: {
    devto: false,
    hashnode: false,
    "linkedin-profile": true,
    "linkedin-page": true,
  },
  linkedinProfileCaption: "Personal perspective",
  linkedinPageCaption: "Company perspective",
};
const markdown = () =>
  stringifyFrontmatter("A complete article body.", metadata);

test("the normalized CLI request retains both LinkedIn destinations and separate captions", () => {
  const payload = buildPublishPayload({
    filePath: "article.md",
    rawFile: markdown(),
  });
  const actual = parseFrontmatter(payload.normalizedMarkdown).data;
  assert.equal(actual.cross_post["linkedin-profile"], true);
  assert.equal(actual.cross_post["linkedin-page"], true);
  assert.equal(actual.linkedinProfileCaption, "Personal perspective");
  assert.equal(actual.linkedinPageCaption, "Company perspective");
  assert.throws(
    () =>
      buildPublishPayload({
        filePath: "article.md",
        rawFile: stringifyFrontmatter("Body", {
          ...metadata,
          cross_post: { "linkedin-page": "yes" },
        }),
      }),
    /cross_post.linkedin-page must be true or false/,
  );
  const aliases = buildPublishPayload({
    filePath: "article.md",
    rawFile: stringifyFrontmatter("Body", {
      title: "Aliases",
      crossPostToLinkedinProfile: true,
      crossPostToLinkedinPage: false,
    }),
  });
  assert.equal(aliases.crossPost["linkedin-profile"], true);
  assert.equal(aliases.crossPost["linkedin-page"], false);
});

test("local-mode sanitization clears every explicit and legacy LinkedIn selection", () => {
  const data = parseFrontmatter(
    disableServerCrossPosting(
      stringifyFrontmatter("Body", {
        ...metadata,
        crossPostToLinkedin: true,
        crossPostToLinkedinPage: true,
      }),
    ),
  ).data;
  assert.equal(data.cross_post.linkedin, false);
  assert.equal(data.cross_post["linkedin-profile"], false);
  assert.equal(data.cross_post["linkedin-page"], false);
  assert.equal(data.crossPostToLinkedin, false);
  assert.equal(data.crossPostToLinkedinProfile, false);
  assert.equal(data.crossPostToLinkedinPage, false);
});

test("LinkedIn captions validate during local payload preparation and preserve default resets", () => {
  for (const value of [42, "x".repeat(2501)]) {
    assert.throws(
      () =>
        buildPublishPayload({
          filePath: "article.md",
          rawFile: stringifyFrontmatter("Body", {
            ...metadata,
            linkedinPageCaption: value,
          }),
        }),
      /linkedinPageCaption/,
    );
  }
  const actual = buildPublishPayload({
    filePath: "article.md",
    rawFile: stringifyFrontmatter("Body", {
      ...metadata,
      linkedinProfileCaption: null,
      linkedinPageCaption: "   ",
    }),
  });
  assert.equal(actual.normalizedFrontmatter.linkedinProfileCaption, null);
  assert.equal(actual.normalizedFrontmatter.linkedinPageCaption, null);
});

for (const mode of ["developer", "password"]) {
  test(`${mode} publishing forwards both destinations and captions through the actual API path`, async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyvop-linkedin-"));
    const file = path.join(dir, "article.md");
    fs.writeFileSync(file, markdown());
    const originalFetch = globalThis.fetch,
      originalLog = console.log;
    const calls = [];
    t.after(() => {
      globalThis.fetch = originalFetch;
      console.log = originalLog;
      fs.rmSync(dir, { recursive: true, force: true });
    });
    console.log = () => {};
    globalThis.fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      const post = {
        id: "post-1",
        slug: "two-linkedin-audiences",
        title: metadata.title,
        status: "DRAFT",
      };
      const body =
        mode === "developer"
          ? { success: true, action: "created", data: post }
          : { data: { createPost: post } };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
      };
    };
    await publishCommand(file, {
      token: mode === "developer" ? "zv_test_developer" : "test-session-token",
      endpoint: "https://example.invalid/graphql",
    });
    assert.equal(calls.length, 1);
    if (mode === "developer") {
      const actual = parseFrontmatter(calls[0].body.content).data;
      assert.equal(actual.cross_post["linkedin-page"], true);
      assert.equal(actual.cross_post["linkedin-profile"], true);
      assert.equal(actual.linkedinPageCaption, "Company perspective");
    } else {
      const input = calls[0].body.variables.input;
      assert.equal(input.crossPostToLinkedinProfile, true);
      assert.equal(input.crossPostToLinkedinPage, true);
      assert.equal(input.linkedinProfileCaption, "Personal perspective");
      assert.equal(input.linkedinPageCaption, "Company perspective");
    }
  });
}

test("selecting LinkedIn in local mode fails before credentials or network requests", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyvop-linkedin-local-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "article.md");
  fs.writeFileSync(file, markdown());
  await assert.rejects(
    publishCommand(file, {
      local: true,
      token: "zv_test",
      endpoint: "https://example.invalid/graphql",
    }),
    /Remove --local/,
  );
});
