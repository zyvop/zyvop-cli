import { dump, load } from "js-yaml";

const FRONTMATTER_PATTERN = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export function parseFrontmatter(input) {
  const match = FRONTMATTER_PATTERN.exec(input);
  if (!match) return { data: {}, content: input.replace(/^\uFEFF/, "") };

  const parsed = load(match[1]);
  if (parsed != null && (typeof parsed !== "object" || Array.isArray(parsed))) {
    throw new Error("Frontmatter must contain a YAML object");
  }

  return {
    data: parsed || {},
    content: input.slice(match[0].length),
  };
}

export function stringifyFrontmatter(content, data) {
  const yaml = dump(data, { lineWidth: -1, noRefs: true });
  const separator = content.startsWith("\n") ? "" : "\n";
  return `---\n${yaml}---${separator}${content}`;
}
