import { createHash } from "node:crypto";
import { toDevToAiDisclosureLevel } from "../../ai-disclosure.js";
import {
  responseJson,
  sanitizeTag,
  stableArticleKey,
  normalizeDevToUrl,
  truncateBlueskyPost,
  blueskyLinkFacet,
} from "./helpers.js";
const HASHNODE_API_URL = "https://gql-beta.hashnode.com";

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
        ai_disclosure_level: toDevToAiDisclosureLevel(payload.aiDisclosure),
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
