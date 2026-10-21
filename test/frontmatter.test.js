import assert from "node:assert/strict";
import test from "node:test";
import { parseFrontmatter, stringifyFrontmatter } from "../src/frontmatter.js";

test("frontmatter parser preserves YAML metadata and Markdown", () => {
  const parsed = parseFrontmatter(
    "---\ntitle: Hello\ntags:\n  - one\n---\n# Body\n",
  );

  assert.deepEqual(parsed.data, { title: "Hello", tags: ["one"] });
  assert.equal(parsed.content, "# Body\n");
});

test("frontmatter parser preserves documents without metadata", () => {
  const parsed = parseFrontmatter("\uFEFF# Body\n");

  assert.deepEqual(parsed.data, {});
  assert.equal(parsed.content, "# Body\n");
});

test("frontmatter parser accepts empty, comment-only, and CRLF metadata", () => {
  assert.deepEqual(parseFrontmatter("---\n---\nBody"), {
    data: {},
    content: "Body",
  });
  assert.deepEqual(
    parseFrontmatter("---\n# metadata intentionally empty\n---\nBody"),
    { data: {}, content: "Body" },
  );
  assert.deepEqual(parseFrontmatter("---\r\ntitle: Hello\r\n...\r\nBody"), {
    data: { title: "Hello" },
    content: "Body",
  });
});

test("frontmatter parser rejects non-object YAML", () => {
  assert.throws(
    () => parseFrontmatter("---\n- invalid\n---\nBody"),
    /YAML object/,
  );
});

test("frontmatter parser rejects unsafe or unreasonable metadata", () => {
  delete globalThis.__frontmatterProbe;
  assert.throws(
    () => parseFrontmatter("---\ntitle: Missing close\nBody"),
    /closing delimiter/,
  );
  assert.throws(
    () =>
      parseFrontmatter(
        '---js\n(globalThis.__frontmatterProbe = true, { title: "Unsafe" })\n---\nBody',
      ),
    /Only YAML frontmatter/,
  );
  assert.equal(globalThis.__frontmatterProbe, undefined);
  assert.throws(
    () =>
      parseFrontmatter(
        "---\ntitle: Aliased\nloop: &loop\n  self: *loop\n---\nBody",
      ),
    /alias/i,
  );
  assert.throws(
    () =>
      parseFrontmatter(
        `---\nvalue: ${"x".repeat(128 * 1024)}\n---\nBody`,
      ),
    /128KB limit/,
  );
});

test("frontmatter serializer round-trips metadata and content", () => {
  const markdown = stringifyFrontmatter("Body", {
    title: "Hello",
    tags: ["one", "two"],
  });

  assert.deepEqual(parseFrontmatter(markdown), {
    data: { title: "Hello", tags: ["one", "two"] },
    content: "Body",
  });
});
