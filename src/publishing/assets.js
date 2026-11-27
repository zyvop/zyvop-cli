const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export function optionalString(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function absoluteHttpUrl(value, fieldName) {
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

export function resolveAssetUrl(value, baseUrl, fieldName) {
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

export function resolveMarkdownAssets(content, baseUrl) {
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
