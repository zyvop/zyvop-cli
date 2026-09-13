import { createHash } from "node:crypto";
import matter from "gray-matter";

const ALL_PLATFORMS = ["devto", "hashnode", "medium", "bluesky", "wordpress"];
const HASHNODE_API_URL = "https://gql-beta.hashnode.com";

const CREDENTIAL_SPECS = {
  devto: ["ZYVOP_DEVTO_API_KEY"],
  hashnode: ["ZYVOP_HASHNODE_API_KEY"],
  medium: ["ZYVOP_MEDIUM_API_TOKEN"],
  bluesky: ["ZYVOP_BLUESKY_IDENTIFIER", "ZYVOP_BLUESKY_APP_PASSWORD"],
  wordpress: [
    "ZYVOP_WORDPRESS_URL",
    "ZYVOP_WORDPRESS_USERNAME",
    "ZYVOP_WORDPRESS_APP_PASSWORD",
  ],
};

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function errorText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function responseJson(response, label) {
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

function sanitizeTag(tag) {
  return String(tag)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function stableArticleKey(payload, zyvopPost, canonicalUrl) {
  return String(
    zyvopPost?.id ||
      payload.postId ||
      canonicalUrl ||
      zyvopPost?.slug ||
      payload.title,
  );
}

function normalizeDevToUrl(data) {
  if (data?.url) return data.url;
  if (data?.path?.startsWith("/")) return `https://dev.to${data.path}`;
  return data?.path;
}

function wordpressBaseUrl(value) {
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

function truncateBlueskyPost(title, excerpt, url) {
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

function blueskyLinkFacet(text, url) {
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

export function requestedLocalPlatforms(crossPost) {
  return ALL_PLATFORMS.filter((platform) => crossPost?.[platform] === true);
}

export function resolveLocalCredentials(platform, env = process.env) {
  const missing = (CREDENTIAL_SPECS[platform] || []).filter(
    (name) => !clean(env[name]),
  );
  if (missing.length > 0) {
    throw new Error(`${platform}: missing ${missing.join(", ")}`);
  }

  switch (platform) {
    case "devto":
      return { apiKey: clean(env.ZYVOP_DEVTO_API_KEY) };
    case "hashnode":
      return {
        apiKey: clean(env.ZYVOP_HASHNODE_API_KEY)?.replace(/^Bearer\s+/i, ""),
      };
    case "medium":
      return { apiToken: clean(env.ZYVOP_MEDIUM_API_TOKEN) };
    case "bluesky":
      return {
        identifier: clean(env.ZYVOP_BLUESKY_IDENTIFIER),
        appPassword: clean(env.ZYVOP_BLUESKY_APP_PASSWORD),
      };
    case "wordpress":
      return {
        url: wordpressBaseUrl(clean(env.ZYVOP_WORDPRESS_URL)),
        username: clean(env.ZYVOP_WORDPRESS_USERNAME),
        appPassword: clean(env.ZYVOP_WORDPRESS_APP_PASSWORD),
      };
    default:
      throw new Error(`Unsupported local platform: ${platform}`);
  }
}

export function resolveAllLocalCredentials(crossPost, env = process.env) {
  const credentials = {};
  const errors = [];
  for (const platform of requestedLocalPlatforms(crossPost)) {
    try {
      credentials[platform] = resolveLocalCredentials(platform, env);
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `Local credentials are incomplete:\n  - ${errors.join("\n  - ")}`,
    );
  }
  return credentials;
}

export function disableServerCrossPosting(normalizedMarkdown) {
  const parsed = matter(normalizedMarkdown);
  const data = { ...parsed.data };
  data.cross_post = Object.fromEntries(
    ALL_PLATFORMS.map((platform) => [platform, false]),
  );
  data.crossPostToDevTo = false;
  data.crossPostToHashnode = false;
  data.crossPostToMedium = false;
  data.crossPostToBluesky = false;
  data.crossPostToWordpress = false;
  data.syndication_mode = "local";
  return matter.stringify(parsed.content, data);
}

export async function publishToDevTo(context, credentials, fetchImpl = fetch) {
  const { payload, canonicalUrl } = context;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "api-key": credentials.apiKey,
  };
  const listResponse = await fetchImpl(
    "https://dev.to/api/articles/me/all?per_page=1000",
    {
      headers,
    },
  );
  const articles = await responseJson(listResponse, "Dev.to lookup");
  const existing = Array.isArray(articles)
    ? articles.find((article) => article?.canonical_url === canonicalUrl)
    : undefined;
  const url = existing?.id
    ? `https://dev.to/api/articles/${existing.id}`
    : "https://dev.to/api/articles";
  const response = await fetchImpl(url, {
    method: existing?.id ? "PUT" : "POST",
    headers,
    body: JSON.stringify({
      article: {
        title: payload.title,
        body_markdown: payload.content,
        published: true,
        main_image: payload.coverImage,
        canonical_url: canonicalUrl,
        description: payload.excerpt || payload.subtitle,
        tags: payload.tagNames.slice(0, 4).map(sanitizeTag).filter(Boolean),
      },
    }),
  });
  const data = await responseJson(response, "Dev.to publish");
  return {
    platform: "devto",
    action: existing?.id ? "updated" : "created",
    remoteId: data.id?.toString(),
    url: normalizeDevToUrl(data),
  };
}

async function hashnodeRequest(query, variables, apiKey, fetchImpl, label) {
  const response = await fetchImpl(HASHNODE_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await responseJson(response, label);
  if (data.errors?.length) {
    throw new Error(
      `${label} failed: ${data.errors.map((item) => item.message).join(" | ")}`,
    );
  }
  return data.data;
}

export async function publishToHashnode(
  context,
  credentials,
  fetchImpl = fetch,
) {
  const { payload, canonicalUrl } = context;
  const meQuery = `query Me {
    me {
      publications(first: 1) {
        edges { node { id posts(first: 50) { edges { node { id canonicalUrl url } } } } }
      }
    }
  }`;
  const me = await hashnodeRequest(
    meQuery,
    {},
    credentials.apiKey,
    fetchImpl,
    "Hashnode lookup",
  );
  const publication = me?.me?.publications?.edges?.[0]?.node;
  if (!publication?.id)
    throw new Error("Hashnode lookup failed: no publication was found.");
  const existing = publication.posts?.edges
    ?.map((edge) => edge?.node)
    .find((post) => post?.canonicalUrl === canonicalUrl);
  const tags = payload.tagNames
    .slice(0, 5)
    .map((name) => ({ name, slug: sanitizeTag(name) }))
    .filter((tag) => tag.slug);

  const input = {
    title: payload.title,
    subtitle: payload.subtitle || payload.excerpt || undefined,
    metaDescription: payload.excerpt || payload.subtitle || undefined,
    contentMarkdown: payload.content,
    originalArticleURL: canonicalUrl,
    coverImage: payload.coverImage,
    tags,
  };
  const isUpdate = Boolean(existing?.id);
  if (isUpdate) input.id = existing.id;
  else input.publicationId = publication.id;
  const query = isUpdate
    ? "mutation UpdatePost($input: UpdatePostInput!) { updatePost(input: $input) { post { id url } } }"
    : "mutation PublishPost($input: PublishPostInput!) { publishPost(input: $input) { post { id url } } }";
  const result = await hashnodeRequest(
    query,
    { input },
    credentials.apiKey,
    fetchImpl,
    "Hashnode publish",
  );
  const post = isUpdate ? result?.updatePost?.post : result?.publishPost?.post;
  if (!post?.id)
    throw new Error("Hashnode publish failed: no post was returned.");
  return {
    platform: "hashnode",
    action: isUpdate ? "updated" : "created",
    remoteId: post.id,
    url: post.url,
  };
}

export async function publishToMedium(context, credentials, fetchImpl = fetch) {
  const { payload, canonicalUrl } = context;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${credentials.apiToken}`,
  };
  const meResponse = await fetchImpl("https://api.medium.com/v1/me", {
    headers,
  });
  const me = await responseJson(meResponse, "Medium lookup");
  if (!me?.data?.id)
    throw new Error("Medium lookup failed: no author ID was returned.");
  const response = await fetchImpl(
    `https://api.medium.com/v1/users/${me.data.id}/posts`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: payload.title,
        contentFormat: "html",
        content: payload.htmlContent,
        canonicalUrl,
        tags: payload.tagNames.slice(0, 5).map(sanitizeTag).filter(Boolean),
        publishStatus: "public",
      }),
    },
  );
  const data = await responseJson(response, "Medium publish");
  return {
    platform: "medium",
    action: "created",
    remoteId: data?.data?.id,
    url: data?.data?.url,
  };
}

export async function publishToWordpress(
  context,
  credentials,
  fetchImpl = fetch,
) {
  const { payload, canonicalUrl, zyvopPost } = context;
  const slug = zyvopPost?.slug || payload.slug;
  const auth = Buffer.from(
    `${credentials.username}:${credentials.appPassword}`,
  ).toString("base64");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Basic ${auth}`,
  };
  let existing;
  if (slug) {
    const lookup = await fetchImpl(
      `${credentials.url}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=any`,
      { headers },
    );
    const posts = await responseJson(lookup, "WordPress lookup");
    existing = Array.isArray(posts) ? posts[0] : undefined;
  }
  const endpoint = existing?.id
    ? `${credentials.url}/wp-json/wp/v2/posts/${existing.id}`
    : `${credentials.url}/wp-json/wp/v2/posts`;
  const response = await fetchImpl(endpoint, {
    method: existing?.id ? "PUT" : "POST",
    headers,
    body: JSON.stringify({
      title: payload.title,
      content: `${payload.htmlContent}\n<hr><p><em>Originally published at <a href="${canonicalUrl}">${canonicalUrl}</a>.</em></p>`,
      excerpt: payload.excerpt || payload.subtitle || "",
      slug,
      status: "publish",
    }),
  });
  const data = await responseJson(response, "WordPress publish");
  return {
    platform: "wordpress",
    action: existing?.id ? "updated" : "created",
    remoteId: data.id?.toString(),
    url: data.link,
  };
}

export async function publishToBluesky(
  context,
  credentials,
  fetchImpl = fetch,
) {
  const { payload, canonicalUrl, zyvopPost } = context;
  const sessionResponse = await fetchImpl(
    "https://bsky.social/xrpc/com.atproto.server.createSession",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: credentials.identifier,
        password: credentials.appPassword,
      }),
    },
  );
  const session = await responseJson(sessionResponse, "Bluesky login");
  if (!session?.accessJwt || !session?.did) {
    throw new Error("Bluesky login failed: no session was returned.");
  }

  const text = truncateBlueskyPost(
    payload.title,
    payload.excerpt || payload.subtitle,
    canonicalUrl,
  );
  const rkey = `zyvop-${createHash("sha256")
    .update(stableArticleKey(payload, zyvopPost, canonicalUrl))
    .digest("hex")
    .slice(0, 24)}`;
  const record = {
    $type: "app.bsky.feed.post",
    text,
    facets: blueskyLinkFacet(text, canonicalUrl),
    createdAt: new Date().toISOString(),
  };
  const response = await fetchImpl(
    "https://bsky.social/xrpc/com.atproto.repo.putRecord",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        rkey,
        record,
        validate: true,
      }),
    },
  );
  await responseJson(response, "Bluesky publish");
  const handle = session.handle || credentials.identifier;
  return {
    platform: "bluesky",
    action: "created or updated",
    remoteId: rkey,
    url: `https://bsky.app/profile/${handle}/post/${rkey}`,
  };
}

const LOCAL_PUBLISHERS = {
  devto: publishToDevTo,
  hashnode: publishToHashnode,
  medium: publishToMedium,
  bluesky: publishToBluesky,
  wordpress: publishToWordpress,
};

export async function crossPostLocally({
  payload,
  zyvopPost,
  liveUrl,
  credentials,
}) {
  const canonicalUrl = payload.canonicalUrl || liveUrl;
  if (!canonicalUrl)
    throw new Error("Local cross-posting requires a canonical or ZyVOP URL.");
  const context = { payload, zyvopPost, canonicalUrl };
  return Promise.all(
    requestedLocalPlatforms(payload.crossPost).map(async (platform) => {
      try {
        const result = await LOCAL_PUBLISHERS[platform](
          context,
          credentials[platform],
        );
        return { ...result, success: true };
      } catch (error) {
        return {
          platform,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}
