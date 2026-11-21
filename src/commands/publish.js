import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import pc from "picocolors";
import {
  createPostApi,
  getOwnedPostApi,
  publishArticleRestApi,
  updatePostApi,
} from "../api.js";
import { resolveAuthToken, resolveEndpoint, resolveWebUrl } from "../config.js";
import { renderPublishPreview } from "./publish/preview.js";
import { publishSuccessMessage, renderZyvopResult } from "./publish/result.js";
import { renderSyndication } from "./publish/syndication.js";
import { buildPublishPayload } from "../publish-payload.js";
import {
  disableServerCrossPosting,
  resolveAllLocalCredentials,
} from "../local-cross-post.js";

export async function publishCommand(filePath, options) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.log(pc.red(`\nError: File not found at ${resolvedPath}\n`));
    process.exit(1);
  }

  const rawFile = fs.readFileSync(resolvedPath, "utf-8");
  let payload;
  try {
    payload = buildPublishPayload({ filePath, rawFile, options });
  } catch (error) {
    console.log(pc.red(`\nError: ${error.message}\n`));
    process.exitCode = 1;
    return;
  }

  const {
    title,
    subtitle,
    excerpt,
    canonicalUrl,
    coverImage,
    tagNames,
    status,
    crossPost,
    categorySlug,
    seriesId,
    metaTitle,
    metaDescription,
    ogTitle,
    ogDescription,
    generateTOC,
    commentsEnabled,
    aiDisclosureLevel,
    aiDisclosureNote,
    aiReviewConfirmed,
    statusExplicit,
    postId,
    slug,
  } = payload;
  const crossPostToDevTo = crossPost.devto;
  const crossPostToHashnode = crossPost.hashnode;
  const crossPostToMedium = crossPost.medium;
  const crossPostToBluesky = crossPost.bluesky;
  const crossPostToWordpress = crossPost.wordpress;

  // Dry-run mode
  if (options.dryRun) {
    renderPublishPreview(payload, options, resolvedPath);
    return;
  }

  const token = resolveAuthToken(options.token);
  const endpoint = resolveEndpoint(options.endpoint);
  if (!token) {
    console.log(pc.red("\nError: You are not logged in."));
    console.log(
      pc.yellow(
        "Run `zyvop login` or pass `--token <your-token>` to authenticate.\n",
      ),
    );
    process.exitCode = 1;
    return;
  }

  let localCredentials = {};
  if (options.local && status === "PUBLISHED") {
    try {
      localCredentials = resolveAllLocalCredentials(crossPost);
    } catch (error) {
      console.log(pc.red(`\nError: ${error.message}\n`));
      console.log(
        pc.dim(
          "Provider credentials are read from the current process environment only and are never uploaded or saved by the CLI.\n",
        ),
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log(pc.bold(pc.cyan(`\n📦 Preparing to publish: "${title}"`)));
  console.log(pc.dim(`File: ${resolvedPath}`));
  if (tagNames.length > 0) console.log(pc.dim(`Tags: ${tagNames.join(", ")}`));
  console.log(pc.dim(`Status: ${status}`));

  const syndicationTargets = [];
  if (crossPostToDevTo) syndicationTargets.push("dev.to");
  if (crossPostToHashnode) syndicationTargets.push("Hashnode");
  if (crossPostToMedium) syndicationTargets.push("Medium");
  if (crossPostToBluesky) syndicationTargets.push("Bluesky");
  if (crossPostToWordpress) syndicationTargets.push("WordPress");

  if (syndicationTargets.length > 0) {
    const mode = options.local ? "local/direct" : "ZyVOP server";
    console.log(
      pc.dim(`Syndication (${mode}): ${syndicationTargets.join(", ")}`),
    );
  } else {
    console.log(pc.dim("Syndication: ZyVOP only"));
  }
  console.log();

  const spinner = ora(
    status === "DRAFT"
      ? "Saving draft to ZyVOP..."
      : options.local
        ? "Publishing article to ZyVOP..."
        : "Broadcasting article to ZyVOP and connected targets...",
  ).start();
  let post;
  let action;
  let liveUrl;
  try {
    if (token.startsWith("zv_")) {
      const markdown = options.local
        ? disableServerCrossPosting(payload.normalizedMarkdown)
        : payload.normalizedMarkdown;
      post = await publishArticleRestApi(markdown, token, endpoint);
      action = post.action === "updated" ? "updated" : "created";
      liveUrl = post.url || resolveWebUrl(post.slug, endpoint);
    } else {
      const serverCrossPostEnabled = !options.local;
      const graphqlInput = {
        title,
        subtitle,
        excerpt,
        content: payload.htmlContent,
        coverImage,
        canonicalUrl,
        tagNames,
        status,
        categorySlug,
        seriesId,
        metaTitle,
        metaDescription,
        ogTitle,
        ogDescription,
        generateTOC,
        commentsEnabled,
        aiDisclosureLevel,
        aiDisclosureNote,
        aiReviewConfirmed,
        suppressAutoCrossPost: options.local === true,
        crossPostToDevTo: serverCrossPostEnabled && crossPostToDevTo,
        crossPostToHashnode: serverCrossPostEnabled && crossPostToHashnode,
        crossPostToMedium: serverCrossPostEnabled && crossPostToMedium,
        crossPostToBluesky: serverCrossPostEnabled && crossPostToBluesky,
        crossPostToWordpress: serverCrossPostEnabled && crossPostToWordpress,
      };
      const existingPost = await getOwnedPostApi(
        { id: postId, slug },
        token,
        endpoint,
      );
      if (existingPost) {
        const updateInput = { ...graphqlInput, id: existingPost.id };
        if (!statusExplicit) delete updateInput.status;
        post = await updatePostApi(updateInput, token, endpoint);
        action = "updated";
      } else {
        post = await createPostApi(graphqlInput, token, endpoint);
        action = "created";
      }
      liveUrl = resolveWebUrl(post.slug, endpoint);
    }

    const savedStatus = post.status || status;
    spinner.succeed(
      pc.green(pc.bold(publishSuccessMessage(savedStatus, action))),
    );

    renderZyvopResult(post, action, liveUrl, endpoint, savedStatus);

    await renderSyndication({
      options,
      payload,
      post,
      liveUrl,
      localCredentials,
      token,
      endpoint,
      status: savedStatus,
    });
  } catch (err) {
    spinner.fail(pc.red(`Failed to publish: ${err.message}\n`));
    process.exitCode = 1;
  }
}
