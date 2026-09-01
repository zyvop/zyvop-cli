import test from "node:test";
import assert from "node:assert/strict";
import {
  getOwnedPostApi,
  publishArticleRestApi,
  updatePostApi,
} from "../src/api.js";

test("developer-token publishing sends the supplied normalized Markdown", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  let request;
  global.fetch = async (url, init) => {
    request = { url, init };
    return {
      ok: true,
      json: async () => ({
        data: { id: "post-id", slug: "article" },
        action: "updated",
      }),
    };
  };

  const markdown = "---\ntitle: Normalized\nstatus: DRAFT\n---\nBody";
  const result = await publishArticleRestApi(
    markdown,
    "zv_test",
    "https://zyvop.com/graphql",
  );

  assert.equal(request.url, "https://zyvop.com/api/v1/articles");
  assert.equal(JSON.parse(request.init.body).content, markdown);
  assert.equal(request.init.headers.Authorization, "Bearer zv_test");
  assert.equal(result.action, "updated");
});

test("owned-post lookup performs no request without a stable identity", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async () => {
    throw new Error("fetch should not run");
  };
  assert.equal(
    await getOwnedPostApi({}, "token", "https://zyvop.com/graphql"),
    null,
  );
});

test("GraphQL update submits UpdatePostInput", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  let requestBody;
  global.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        data: { updatePost: { id: "post-id", slug: "article" } },
      }),
    };
  };

  await updatePostApi(
    { id: "post-id", title: "Updated" },
    "jwt-token",
    "https://zyvop.com/graphql",
  );

  assert.match(requestBody.query, /mutation UpdatePost/);
  assert.deepEqual(requestBody.variables.input, {
    id: "post-id",
    title: "Updated",
  });
});
