import { createHash } from "node:crypto";

export function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function errorText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export async function responseJson(response, label) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `${label} returned a non-JSON response (${response.status}).`,
    );
  }
  if (!response.ok) {
    const detail =
      data?.error ||
      data?.message ||
      data?.errors?.[0]?.message ||
      errorText(text);
    throw new Error(
      `${label} failed (${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }
  return data;
}

export function sanitizeTag(tag) {
  return String(tag)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export function stableArticleKey(payload, zyvopPost, canonicalUrl) {
  return String(
    zyvopPost?.id ||
      payload.postId ||
      canonicalUrl ||
      zyvopPost?.slug ||
      payload.title,
  );
}

export function normalizeDevToUrl(data) {
  if (data?.url) return data.url;
  if (data?.path?.startsWith("/")) return `https://dev.to${data.path}`;
  return data?.path;
}

export function wordpressBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "ZYVOP_WORDPRESS_URL must be an absolute http:// or https:// URL.",
    );
  }
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw new Error("ZYVOP_WORDPRESS_URL must use http:// or https://.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

export function truncateBlueskyPost(title, excerpt, url) {
  const suffix = `\n\nRead more: ${url}`;
  const prefix = `New post: ${title}`;
  let text = excerpt
    ? `${prefix}\n\n${excerpt}${suffix}`
    : `${prefix}${suffix}`;
  if (Array.from(text).length <= 300) return text;

  const availableExcerpt =
    300 - Array.from(prefix).length - Array.from(suffix).length - 6;
  if (excerpt && availableExcerpt > 10) {
    text = `${prefix}\n\n${Array.from(excerpt).slice(0, availableExcerpt).join("")}...${suffix}`;
  } else {
    text = `${prefix}${suffix}`;
  }
  if (Array.from(text).length <= 300) return text;

  const availableTitle = Math.max(0, 300 - Array.from(suffix).length - 14);
  return `New post: ${Array.from(title).slice(0, availableTitle).join("")}...${suffix}`;
}

export function blueskyLinkFacet(text, url) {
  const characterStart = text.lastIndexOf(url);
  if (characterStart < 0) return [];
  return [
    {
      index: {
        byteStart: Buffer.byteLength(text.slice(0, characterStart), "utf8"),
        byteEnd: Buffer.byteLength(
          text.slice(0, characterStart + url.length),
          "utf8",
        ),
      },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
    },
  ];
}
