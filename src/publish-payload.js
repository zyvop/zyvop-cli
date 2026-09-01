import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function optionalString(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function absoluteHttpUrl(value, fieldName) {
  const text = optionalString(value, fieldName);
  if (!text) return undefined;

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(
      `${fieldName} must be an absolute http:// or https:// URL.`,
    );
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${fieldName} must use http:// or https://.`);
  }

  return parsed.toString();
}

function resolveAssetUrl(value, baseUrl, fieldName) {
  const text = optionalString(value, fieldName);
  if (!text) return undefined;

  let absolute;
  try {
    absolute = new URL(text);
  } catch {}

  if (absolute) {
    if (!HTTP_PROTOCOLS.has(absolute.protocol)) {
      throw new Error(`${fieldName} must use http:// or https://.`);
    }
    return absolute.toString();
  }

  if (!baseUrl) {
    throw new Error(
      `${fieldName} is relative. Add --base-url, base_url, or canonical_url to resolve it.`,
    );
  }

  return new URL(
    text,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();
}

function resolveMarkdownAssets(content, baseUrl) {
  if (!baseUrl) return { content, resolvedAssetCount: 0 };

  let resolvedAssetCount = 0;
  const resolveRelative = (candidate) => {
    const value = candidate.trim();
    if (!value || value.startsWith("#") || value.startsWith("data:")) {
      return candidate;
    }

    try {
      const absolute = new URL(value);
      if (!HTTP_PROTOCOLS.has(absolute.protocol)) {
        throw new Error(`Image URL must use http:// or https://: ${value}`);
      }
      return candidate;
    } catch {
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        throw new Error(`Image URL must use http:// or https://: ${value}`);
      }
      resolvedAssetCount += 1;
      return new URL(
        value,
        baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
      ).toString();
    }
  };

  let resolved = content.replace(
    /(!\[[^\]]*\]\(\s*)(<?)([^)\s>]+)(>?)([^)]*\))/g,
    (match, prefix, openingBracket, url, closingBracket, suffix) => {
      const nextUrl = resolveRelative(url);
      return `${prefix}${openingBracket}${nextUrl}${closingBracket}${suffix}`;
    },
  );

  resolved = resolved.replace(
    /(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, url, suffix) => `${prefix}${resolveRelative(url)}${suffix}`,
  );

  return { content: resolved, resolvedAssetCount };
}

function setIfDefined(target, key, value) {
  if (value !== undefined) target[key] = value;
}

export function buildPublishPayload({ filePath, rawFile, options = {} }) {
  const parsed = matter(rawFile);
  const frontmatter = parsed.data || {};
  const originalContent = parsed.content || "";

  if (!originalContent.trim()) {
    throw new Error("The markdown file is empty.");
  }

  const title =
    optionalString(options.title, "title") ||
    optionalString(frontmatter.title, "title") ||
    path.basename(filePath, path.extname(filePath));
  const subtitle =
    optionalString(options.subtitle, "subtitle") ||
    optionalString(frontmatter.subtitle, "subtitle") ||
    optionalString(frontmatter.description, "description");
  const excerpt =
    optionalString(options.excerpt, "excerpt") ||
    optionalString(frontmatter.excerpt, "excerpt");

  const canonicalCandidate =
    options.canonical ?? frontmatter.canonical_url ?? frontmatter.canonicalUrl;
  const canonicalUrl = canonicalCandidate
    ? absoluteHttpUrl(canonicalCandidate, "canonical_url")
    : undefined;

  const baseCandidate =
    options.baseUrl ?? frontmatter.base_url ?? frontmatter.baseUrl;
  const baseUrl = baseCandidate
    ? absoluteHttpUrl(baseCandidate, "base_url")
    : canonicalUrl
      ? new URL(canonicalUrl).origin
      : undefined;

  const coverCandidate =
    options.cover ??
    frontmatter.cover_image ??
    frontmatter.coverImage ??
    frontmatter.image;
  const coverImage = coverCandidate
    ? resolveAssetUrl(coverCandidate, baseUrl, "cover_image")
    : undefined;

  let tagNames = [];
  if (options.tags !== undefined) {
    if (typeof options.tags !== "string")
      throw new Error("tags must be a string.");
    tagNames = options.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  } else if (Array.isArray(frontmatter.tags)) {
    tagNames = frontmatter.tags
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  } else if (typeof frontmatter.tags === "string") {
    tagNames = frontmatter.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  } else if (frontmatter.tags !== undefined) {
    throw new Error("tags must be a comma-separated string or an array.");
  }

  const frontmatterStatus = optionalString(
    frontmatter.status,
    "status",
  )?.toUpperCase();
  if (
    frontmatterStatus &&
    !["DRAFT", "PUBLISHED", "SCHEDULED"].includes(frontmatterStatus)
  ) {
    throw new Error("status must be DRAFT, PUBLISHED, or SCHEDULED.");
  }
  const statusExplicit =
    options.draft === true ||
    frontmatter.draft === true ||
    frontmatter.published === false ||
    frontmatterStatus !== undefined;
  const status =
    options.draft === true ||
    frontmatter.draft === true ||
    frontmatter.published === false
      ? "DRAFT"
      : frontmatterStatus || "PUBLISHED";

  const crossPostFm =
    frontmatter.cross_post && typeof frontmatter.cross_post === "object"
      ? frontmatter.cross_post
      : frontmatter.crosspost && typeof frontmatter.crosspost === "object"
        ? frontmatter.crosspost
        : {};
  const crossPost = {
    devto:
      options.devto ??
      crossPostFm.devto ??
      frontmatter.crossPostToDevTo ??
      true,
    hashnode:
      options.hashnode ??
      crossPostFm.hashnode ??
      frontmatter.crossPostToHashnode ??
      true,
    medium:
      options.medium ??
      crossPostFm.medium ??
      frontmatter.crossPostToMedium ??
      false,
    bluesky:
      options.bluesky ??
      crossPostFm.bluesky ??
      frontmatter.crossPostToBluesky ??
      false,
    wordpress:
      options.wordpress ??
      crossPostFm.wordpress ??
      frontmatter.crossPostToWordpress ??
      false,
  };
  for (const [platform, enabled] of Object.entries(crossPost)) {
    if (typeof enabled !== "boolean") {
      throw new Error(`cross_post.${platform} must be true or false.`);
    }
  }

  const categorySlug =
    optionalString(options.category, "category") ||
    optionalString(frontmatter.category_slug, "category_slug") ||
    optionalString(frontmatter.categorySlug, "categorySlug") ||
    optionalString(frontmatter.category, "category");
  const seriesId =
    optionalString(options.series, "series") ||
    optionalString(frontmatter.series_id, "series_id") ||
    optionalString(frontmatter.seriesId, "seriesId");
  const metaTitle =
    optionalString(options.metaTitle, "meta_title") ||
    optionalString(frontmatter.meta_title, "meta_title") ||
    optionalString(frontmatter.metaTitle, "metaTitle");
  const metaDescription =
    optionalString(options.metaDescription, "meta_description") ||
    optionalString(frontmatter.meta_description, "meta_description") ||
    optionalString(frontmatter.metaDescription, "metaDescription");
  const ogTitle =
    optionalString(frontmatter.og_title, "og_title") ||
    optionalString(frontmatter.ogTitle, "ogTitle");
  const ogDescription =
    optionalString(frontmatter.og_description, "og_description") ||
    optionalString(frontmatter.ogDescription, "ogDescription");
  const generateTOC =
    options.toc ??
    frontmatter.generate_toc ??
    frontmatter.generateTOC ??
    frontmatter.toc;
  const commentsEnabled =
    options.comments ??
    frontmatter.comments_enabled ??
    frontmatter.commentsEnabled ??
    true;
  if (generateTOC !== undefined && typeof generateTOC !== "boolean") {
    throw new Error("generate_toc must be true or false.");
  }
  if (typeof commentsEnabled !== "boolean") {
    throw new Error("comments_enabled must be true or false.");
  }

  const postId =
    optionalString(frontmatter.zyvop_id, "zyvop_id") ||
    optionalString(frontmatter.id, "id");
  const slug = optionalString(frontmatter.slug, "slug");
  const { content, resolvedAssetCount } = resolveMarkdownAssets(
    originalContent,
    baseUrl,
  );

  // Preserve unknown keys for dual-use repositories while replacing known ZyVOP
  // fields with the exact normalized values shown by dry-run.
  const normalizedFrontmatter = { ...frontmatter, title };
  setIfDefined(normalizedFrontmatter, "subtitle", subtitle);
  setIfDefined(normalizedFrontmatter, "excerpt", excerpt);
  setIfDefined(normalizedFrontmatter, "canonical_url", canonicalUrl);
  setIfDefined(normalizedFrontmatter, "base_url", baseUrl);
  setIfDefined(normalizedFrontmatter, "cover_image", coverImage);
  if (
    tagNames.length > 0 ||
    frontmatter.tags !== undefined ||
    options.tags !== undefined
  ) {
    normalizedFrontmatter.tags = tagNames;
  }
  if (statusExplicit) normalizedFrontmatter.status = status;
  setIfDefined(normalizedFrontmatter, "category_slug", categorySlug);
  setIfDefined(normalizedFrontmatter, "series_id", seriesId);
  setIfDefined(normalizedFrontmatter, "meta_title", metaTitle);
  setIfDefined(normalizedFrontmatter, "meta_description", metaDescription);
  setIfDefined(normalizedFrontmatter, "og_title", ogTitle);
  setIfDefined(normalizedFrontmatter, "og_description", ogDescription);
  setIfDefined(normalizedFrontmatter, "generate_toc", generateTOC);
  normalizedFrontmatter.comments_enabled = commentsEnabled;
  normalizedFrontmatter.cross_post = crossPost;
  if (postId) normalizedFrontmatter.id = postId;

  return {
    title,
    subtitle,
    excerpt,
    canonicalUrl,
    baseUrl,
    coverImage,
    tagNames,
    status,
    statusExplicit,
    crossPost,
    categorySlug,
    seriesId,
    metaTitle,
    metaDescription,
    ogTitle,
    ogDescription,
    generateTOC,
    commentsEnabled,
    postId,
    slug,
    content,
    htmlContent: marked.parse(content),
    normalizedFrontmatter,
    normalizedMarkdown: matter.stringify(content, normalizedFrontmatter),
    resolvedAssetCount,
  };
}
