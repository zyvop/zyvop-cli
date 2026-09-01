import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import pc from "picocolors";
import {
  createPostApi,
  getOwnedPostApi,
  getMyIntegrationsApi,
  publishArticleRestApi,
  updatePostApi,
} from "../api.js";
import { resolveAuthToken, resolveEndpoint, resolveWebUrl } from "../config.js";
import { buildPublishPayload } from "../publish-payload.js";

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
    statusExplicit,
    postId,
    slug,
    resolvedAssetCount,
  } = payload;
  const crossPostToDevTo = crossPost.devto;
  const crossPostToHashnode = crossPost.hashnode;
  const crossPostToMedium = crossPost.medium;
  const crossPostToBluesky = crossPost.bluesky;
  const crossPostToWordpress = crossPost.wordpress;

  // Dry-run mode
  if (options.dryRun) {
    console.log(
      pc.bold(
        pc.yellow(`\n🔍 [DRY RUN] Previewing publish payload for: "${title}"`),
      ),
    );
    console.log(
      pc.dim(
        "Local validation only; no network requests or writes were performed.",
      ),
    );
    console.log(
      pc.bold("────────────────────────────────────────────────────────────"),
    );
    console.log(`  📄 ${pc.bold("File:")}            ${pc.cyan(resolvedPath)}`);
    console.log(`  🏷️  ${pc.bold("Title:")}           ${title}`);
    if (subtitle)
      console.log(`  📝 ${pc.bold("Subtitle:")}        ${subtitle}`);
    if (excerpt) console.log(`  📜 ${pc.bold("Excerpt:")}         ${excerpt}`);
    console.log(`  🚦 ${pc.bold("Status:")}          ${status}`);
    if (canonicalUrl)
      console.log(
        `  🔗 ${pc.bold("Canonical URL:")}   ${pc.dim(canonicalUrl)}`,
      );
    if (coverImage)
      console.log(`  🖼️  ${pc.bold("Cover Image:")}     ${pc.dim(coverImage)}`);
    if (tagNames.length > 0)
      console.log(
        `  🏷️  ${pc.bold("Tags:")}            ${tagNames.join(", ")}`,
      );
    if (categorySlug)
      console.log(`  📁 ${pc.bold("Category:")}        ${categorySlug}`);
    if (seriesId)
      console.log(`  📚 ${pc.bold("Series ID:")}       ${seriesId}`);
    if (postId) console.log(`  🆔 ${pc.bold("ZyVOP ID:")}        ${postId}`);
    else if (slug) console.log(`  🔑 ${pc.bold("ZyVOP Slug:")}      ${slug}`);
    console.log(`  🧩 ${pc.bold("Assets resolved:")} ${resolvedAssetCount}`);
    console.log(
      `  ⚡ ${pc.bold("Publish action:")}  ${pc.yellow(
        postId || slug
          ? "Update when this owned post exists; otherwise create"
          : canonicalUrl
            ? "Create or update by canonical URL with a developer token"
            : "Determined by the server during publish",
      )}`,
    );
    console.log(
      pc.bold("────────────────────────────────────────────────────────────"),
    );
    console.log(pc.bold("  📡 Syndication Targets:"));
    const targets = [
      { name: "ZyVOP (Primary)", enabled: true },
      { name: "dev.to", enabled: crossPostToDevTo },
      { name: "Hashnode", enabled: crossPostToHashnode },
      { name: "Medium", enabled: crossPostToMedium },
      { name: "Bluesky", enabled: crossPostToBluesky },
      { name: "WordPress", enabled: crossPostToWordpress },
    ];
    targets.forEach((t) => {
      const state = t.enabled ? pc.green("✓ Requested") : pc.dim("✗ Skipped");
      console.log(`     ${t.name.padEnd(20)} ${state}`);
    });
    console.log(
      pc.bold("────────────────────────────────────────────────────────────\n"),
    );
    console.log(
      pc.green(
        "✨ Local payload validation completed. The server will decide create/update state.\n",
      ),
    );
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
    console.log(pc.dim(`Syndication: ${syndicationTargets.join(", ")}`));
  } else {
    console.log(pc.dim("Syndication: ZyVOP only"));
  }
  console.log();

  const spinner = ora(
    "Broadcasting article to ZyVOP and connected targets...",
  ).start();

  if (token.startsWith("zv_")) {
    try {
      const post = await publishArticleRestApi(
        payload.normalizedMarkdown,
        token,
        endpoint,
      );
      const isUpdated = post.action === "updated";
      const successMsg = isUpdated
        ? "Article updated successfully! 🔄\n"
        : "Article published successfully! 🎉\n";
      spinner.succeed(pc.green(pc.bold(successMsg)));
      const liveUrl = post.url || resolveWebUrl(post.slug, endpoint);
      console.log(
        pc.bold("────────────────────────────────────────────────────────────"),
      );
      console.log(`  🌐 ${pc.bold("ZyVOP Live URL:")}  ${pc.cyan(liveUrl)}`);
      if (post.id)
        console.log(`  🆔 ${pc.bold("ZyVOP Post ID:")}   ${post.id}`);
      if (isUpdated) {
        console.log(
          `  ⚡ ${pc.bold("Action:")}          ${pc.yellow("Updated existing article")}`,
        );
      } else {
        console.log(
          `  ⚡ ${pc.bold("Action:")}          ${pc.green("Created new article")}`,
        );
      }
      console.log(
        pc.bold(
          "────────────────────────────────────────────────────────────\n",
        ),
      );
      return;
    } catch (err) {
      spinner.fail(pc.red(`Failed to publish: ${err.message}\n`));
      process.exitCode = 1;
      return;
    }
  }

  try {
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
      crossPostToDevTo,
      crossPostToHashnode,
      crossPostToMedium,
      crossPostToBluesky,
      crossPostToWordpress,
    };
    const existingPost = await getOwnedPostApi(
      { id: postId, slug },
      token,
      endpoint,
    );
    let post;
    let action;
    if (existingPost) {
      const updateInput = { ...graphqlInput, id: existingPost.id };
      if (!statusExplicit) delete updateInput.status;
      post = await updatePostApi(updateInput, token, endpoint);
      action = "updated";
    } else {
      post = await createPostApi(graphqlInput, token, endpoint);
      action = "created";
    }

    spinner.succeed(
      pc.green(
        pc.bold(
          action === "updated"
            ? "Article updated successfully! 🔄\n"
            : "Article published successfully! 🎉\n",
        ),
      ),
    );

    // Check integrations for actionable terminal feedback
    let integrations = null;
    try {
      integrations = await getMyIntegrationsApi(token, endpoint);
    } catch {}

    // Render Clean Success Card
    const liveUrl = resolveWebUrl(post.slug, endpoint);
    const errors = post.crossPostErrors || {};

    const renderTarget = (label, enabled, url, errKey, hasKey) => {
      if (!enabled) return;
      const errorMsg = errors[errKey];
      if (url) {
        console.log(
          `  ${label.padEnd(20)} ${pc.green("Live")} ${pc.dim(`(${url})`)}`,
        );
      } else if (errorMsg) {
        console.log(
          `  ${label.padEnd(20)} ${pc.yellow("Skipped")} ${pc.dim(`(${errorMsg})`)}`,
        );
      } else if (hasKey === false) {
        console.log(
          `  ${label.padEnd(20)} ${pc.yellow("Warning")} ${pc.dim("(Missing API key in Settings > Integrations)")}`,
        );
      } else {
        console.log(`  ${label.padEnd(20)} ${pc.green("Queued & Synced")}`);
      }
    };

    console.log(
      pc.bold("────────────────────────────────────────────────────────────"),
    );
    console.log(`  🌐 ${pc.bold("ZyVOP Live URL:")}  ${pc.cyan(liveUrl)}`);
    console.log(`  🆔 ${pc.bold("ZyVOP Post ID:")}   ${post.id}`);
    console.log(
      `  ⚡ ${pc.bold("Action:")}          ${
        action === "updated"
          ? pc.yellow("Updated existing article")
          : pc.green("Created new article")
      }`,
    );
    renderTarget(
      `⚡ ${pc.bold("dev.to:")}`,
      crossPostToDevTo,
      post.devToArticleUrl,
      "dev.to",
      integrations?.hasDevToApiKey,
    );
    renderTarget(
      `🚀 ${pc.bold("Hashnode:")}`,
      crossPostToHashnode,
      post.hashnodeArticleUrl,
      "hashnode",
      integrations?.hasHashnodeApiKey,
    );
    renderTarget(
      `🦋 ${pc.bold("Bluesky:")}`,
      crossPostToBluesky,
      post.blueskyPostUrl,
      "bluesky",
      integrations?.hasBlueskyIntegration,
    );
    renderTarget(
      `✍️  ${pc.bold("Medium:")}`,
      crossPostToMedium,
      post.mediumArticleUrl,
      "medium",
      integrations?.hasMediumApiKey,
    );
    renderTarget(
      `📝 ${pc.bold("WordPress:")}`,
      crossPostToWordpress,
      post.wordpressArticleUrl,
      "wordpress",
      integrations?.hasWordpressIntegration,
    );
    console.log(
      pc.bold("────────────────────────────────────────────────────────────\n"),
    );
  } catch (err) {
    spinner.fail(pc.red(`Failed to publish: ${err.message}\n`));
    process.exitCode = 1;
  }
}
