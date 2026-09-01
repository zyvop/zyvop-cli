import test from "node:test";
import assert from "node:assert/strict";
import matter from "gray-matter";
import { buildPublishPayload } from "../src/publish-payload.js";

const ARTICLE = `---
title: Dual-use article
layout: BlogPostLayout
readingTime: 4 min
cover_image: /images/cover.webp
canonical_url: https://example.com/blog/article
tags: [nextjs, gitops]
---

![Root image](/images/root.webp)
![Nearby image](./nearby.webp)
<img src="../shared/html.webp" alt="HTML image">
![Remote](https://cdn.example.com/remote.webp)
`;

test("preserves unknown frontmatter and resolves all supported relative assets", () => {
  const payload = buildPublishPayload({
    filePath: "posts/article.md",
    rawFile: ARTICLE,
    options: { baseUrl: "https://site.example/blog/posts/" },
  });
  const submitted = matter(payload.normalizedMarkdown);

  assert.equal(submitted.data.layout, "BlogPostLayout");
  assert.equal(submitted.data.readingTime, "4 min");
  assert.equal(
    submitted.data.cover_image,
    "https://site.example/images/cover.webp",
  );
  assert.match(
    submitted.content,
    /https:\/\/site\.example\/images\/root\.webp/,
  );
  assert.match(
    submitted.content,
    /https:\/\/site\.example\/blog\/posts\/nearby\.webp/,
  );
  assert.match(
    submitted.content,
    /https:\/\/site\.example\/blog\/shared\/html\.webp/,
  );
  assert.match(submitted.content, /https:\/\/cdn\.example\.com\/remote\.webp/);
  assert.equal(payload.resolvedAssetCount, 3);
});

test("applies CLI overrides to the normalized developer-token Markdown", () => {
  const payload = buildPublishPayload({
    filePath: "posts/article.md",
    rawFile: ARTICLE,
    options: {
      cover: "/override.webp",
      baseUrl: "https://override.example",
      draft: true,
      devto: false,
      hashnode: true,
      tags: "security, cli",
    },
  });
  const submitted = matter(payload.normalizedMarkdown);

  assert.equal(
    submitted.data.cover_image,
    "https://override.example/override.webp",
  );
  assert.equal(submitted.data.status, "DRAFT");
  assert.deepEqual(submitted.data.tags, ["security", "cli"]);
  assert.equal(submitted.data.cross_post.devto, false);
  assert.equal(submitted.data.cross_post.hashnode, true);
});

test("does not force the default published status into frontmatter", () => {
  const payload = buildPublishPayload({
    filePath: "article.md",
    rawFile: "---\ntitle: Existing draft\n---\nBody",
  });

  assert.equal(payload.status, "PUBLISHED");
  assert.equal(payload.statusExplicit, false);
  assert.equal(matter(payload.normalizedMarkdown).data.status, undefined);
});

test("rejects unsafe or malformed base URLs", () => {
  assert.throws(
    () =>
      buildPublishPayload({
        filePath: "article.md",
        rawFile:
          "---\ntitle: Bad URL\nbase_url: 'javascript:alert(1)'\n---\nBody",
      }),
    /base_url must use http:\/\/ or https:\/\//,
  );

  assert.throws(
    () =>
      buildPublishPayload({
        filePath: "article.md",
        rawFile:
          "---\ntitle: Bad type\nbase_url:\n  nested: true\ncover_image: ./cover.webp\n---\nBody",
      }),
    /base_url must be a string/,
  );
});

test("rejects non-HTTP cover and Markdown image schemes", () => {
  assert.throws(
    () =>
      buildPublishPayload({
        filePath: "article.md",
        rawFile:
          "---\ntitle: Unsafe cover\ncover_image: 'javascript:alert(1)'\n---\nBody",
      }),
    /cover_image must use http:\/\/ or https:\/\//,
  );

  assert.throws(
    () =>
      buildPublishPayload({
        filePath: "article.md",
        rawFile:
          "---\ntitle: Unsafe body\nbase_url: https://example.com\n---\n![x](javascript:alert(1))",
      }),
    /Image URL must use http:\/\/ or https:\/\//,
  );
});

test("requires a base for a relative cover image", () => {
  assert.throws(
    () =>
      buildPublishPayload({
        filePath: "article.md",
        rawFile:
          "---\ntitle: Relative cover\ncover_image: ./cover.webp\n---\nBody",
      }),
    /cover_image is relative/,
  );
});
