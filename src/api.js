export async function graphqlRequest({
  query,
  variables = {},
  token = null,
  endpoint,
}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    throw new Error(
      `Could not connect to ZyVOP server at ${endpoint}: ${err.message}`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Server returned HTTP ${res.status}: ${text || res.statusText}`,
    );
  }

  const json = await res.json();

  if (json.errors && json.errors.length > 0) {
    const message = json.errors.map((e) => e.message).join(" | ");
    throw new Error(message);
  }

  return json.data;
}

export async function publishArticleRestApi(
  rawMarkdown,
  token,
  endpoint = "https://zyvop.com",
) {
  const baseUrl = endpoint.includes("/graphql")
    ? endpoint.replace(/\/graphql\/?$/, "")
    : endpoint.replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/api/v1/articles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: rawMarkdown }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}: ${res.statusText}`);
  }
  return {
    ...(data.data || {}),
    action: data.action || "published",
  };
}

export async function loginApi(email, password, endpoint) {
  const query = `
    mutation Login($input: LoginInput!) {
      login(input: $input) {
        accessToken
        requires2FA
      }
    }
  `;

  const data = await graphqlRequest({
    query,
    variables: { input: { email, password } },
    endpoint,
  });

  return data.login;
}

export async function getMeApi(token, endpoint) {
  const query = `
    query Me {
      me {
        id
        username
        email
        name
      }
    }
  `;

  const data = await graphqlRequest({
    query,
    token,
    endpoint,
  });

  return data.me;
}

export async function getMyIntegrationsApi(token, endpoint) {
  const query = `
    query MyIntegrations {
      myIntegrations {
        hasDevToApiKey
        hasHashnodeApiKey
        hasMediumApiKey
        hasWordpressIntegration
        hasBlueskyIntegration
      }
    }
  `;

  const data = await graphqlRequest({
    query,
    token,
    endpoint,
  });

  return data.myIntegrations;
}

export async function createPostApi(input, token, endpoint) {
  const query = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        id
        slug
        title
        subtitle
        excerpt
        coverImage
        status
        publishedAt
        canonicalUrl
        crossPostToDevTo
        crossPostToHashnode
        crossPostToMedium
        crossPostToBluesky
        crossPostToWordpress
        crossPostErrors
        devToArticleUrl
        hashnodeArticleUrl
        mediumArticleUrl
        blueskyPostUrl
        wordpressArticleUrl
      }
    }
  `;

  const data = await graphqlRequest({
    query,
    variables: { input },
    token,
    endpoint,
  });

  return data.createPost;
}

const OWNED_POST_FIELDS = `
  id
  slug
  title
  status
  devToArticleUrl
  hashnodeArticleUrl
  mediumArticleUrl
  blueskyPostUrl
  wordpressArticleUrl
  crossPostErrors
`;

export async function getOwnedPostApi({ id, slug }, token, endpoint) {
  if (!id && !slug) return null;

  const query = id
    ? `query GetMyPost($id: ID!) { getMyPost(id: $id) { ${OWNED_POST_FIELDS} } }`
    : `query GetMyPostBySlug($slug: String!) { getMyPostBySlug(slug: $slug) { ${OWNED_POST_FIELDS} } }`;
  const data = await graphqlRequest({
    query,
    variables: id ? { id } : { slug },
    token,
    endpoint,
  });

  return id ? data.getMyPost : data.getMyPostBySlug;
}

export async function updatePostApi(input, token, endpoint) {
  const query = `
    mutation UpdatePost($input: UpdatePostInput!) {
      updatePost(input: $input) {
        ${OWNED_POST_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest({
    query,
    variables: { input },
    token,
    endpoint,
  });

  return data.updatePost;
}

export async function importPostsApi(source, identifier, token, endpoint) {
  const query = `
    mutation ImportPosts($source: String!, $identifier: String!) {
      importPosts(source: $source, identifier: $identifier)
    }
  `;

  const data = await graphqlRequest({
    query,
    variables: { source, identifier },
    token,
    endpoint,
  });

  return data.importPosts;
}
