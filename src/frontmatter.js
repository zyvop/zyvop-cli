import { dump, load } from "js-yaml";

const MAX_FRONTMATTER_BYTES = 128 * 1024;
const OPENING_DELIMITER_PATTERN = /^---[ \t]*(?:\r?\n|$)/;
const CLOSING_DELIMITER_PATTERN = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m;

function hasOnlyCommentsOrWhitespace(source) {
  return source.split(/\r?\n/).every((line) => {
    const trimmed = line.trim();
    return !trimmed || trimmed.startsWith("#");
  });
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function parseFrontmatter(input) {
  const source = input.replace(/^\uFEFF/, "");
  const opening = OPENING_DELIMITER_PATTERN.exec(source);
  if (!opening) {
    const firstLine = source.slice(0, source.search(/\r?\n|$/));
    if (/^---(?!-)/.test(firstLine) && firstLine.trim() !== "---") {
      throw new Error(
        "Only YAML frontmatter with a standalone --- delimiter is supported",
      );
    }
    return { data: {}, content: source };
  }

  const afterOpening = source.slice(opening[0].length);
  const closing = CLOSING_DELIMITER_PATTERN.exec(afterOpening);
  if (!closing) throw new Error("Frontmatter is missing a closing delimiter");

  const yamlSource = afterOpening.slice(0, closing.index);
  if (Buffer.byteLength(yamlSource, "utf8") > MAX_FRONTMATTER_BYTES) {
    throw new Error("Frontmatter exceeds the 128KB limit");
  }

  // Frontmatter may come from shared repositories. Aliases are unnecessary
  // metadata features here and can construct cyclic graphs during serialization.
  const parsed = hasOnlyCommentsOrWhitespace(yamlSource)
    ? {}
    : load(yamlSource, { maxAliases: 0, maxDepth: 50 });
  if (parsed != null && !isPlainObject(parsed)) {
    throw new Error("Frontmatter must contain a YAML object");
  }

  return {
    data: parsed || {},
    content: afterOpening.slice(closing.index + closing[0].length),
  };
}

export function stringifyFrontmatter(content, data) {
  const yaml = dump(data, { lineWidth: -1, noRefs: true });
  const separator = content.startsWith("\n") ? "" : "\n";
  return `---\n${yaml}---${separator}${content}`;
}
