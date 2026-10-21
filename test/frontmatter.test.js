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

test("frontmatter parser rejects non-object YAML", () => {
  assert.throws(
    () => parseFrontmatter("---\n- invalid\n---\nBody"),
    /YAML object/,
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
