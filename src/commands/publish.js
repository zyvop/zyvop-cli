import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import ora from "ora";
import pc from "picocolors";
import {
  createPostApi,
  getMyIntegrationsApi,
  publishArticleRestApi,
} from "../api.js";
import { resolveAuthToken, resolveEndpoint, resolveWebUrl } from "../config.js";

export async function publishCommand(filePath, options) {
  const token = resolveAuthToken(options.token);
  const endpoint = resolveEndpoint(options.endpoint);

  if (!token) {
    console.log(pc.red("\nError: You are not logged in."));
    console.log(
      pc.yellow(
        "Run `zyvop login` or pass `--token <your-token>` to authenticate.\n",
      ),
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.log(pc.red(`\nError: File not found at ${resolvedPath}\n`));
    process.exit(1);
  }

  const rawFile = fs.readFileSync(resolvedPath, "utf-8");
  const parsed = matter(rawFile);
  const frontmatter = parsed.data || {};
  const content = parsed.content || "";

  if (!content.trim()) {
    console.log(pc.red("\nError: The markdown file is empty.\n"));
    process.exit(1);
  }

  // Extract metadata from frontmatter + flags
  const title =
    options.title ||
    frontmatter.title ||
    path.basename(filePath, path.extname(filePath));
  const subtitle =
    options.subtitle ||
    frontmatter.subtitle ||
    frontmatter.description ||
    undefined;
  const excerpt = options.excerpt || frontmatter.excerpt || undefined;
  const canonicalUrl =
    options.canonical ||
    frontmatter.canonical_url ||
    frontmatter.canonicalUrl ||
    undefined;

  let baseUrl =
    options.baseUrl ||
    frontmatter.base_url ||
    frontmatter.baseUrl ||
    undefined;

  if (!baseUrl && canonicalUrl) {
    try {
      baseUrl = new URL(canonicalUrl).origin;
    } catch {}
  }

  let coverImage =
    options.cover ||
    frontmatter.cover_image ||
    frontmatter.coverImage ||
    frontmatter.image ||
    undefined;

  if (typeof coverImage === "string") {
    coverImage = coverImage.trim();
    if (coverImage && !coverImage.startsWith("http://") && !coverImage.startsWith("https://")) {
      if (baseUrl) {
        const cleanBase = baseUrl.replace(/\/+$/, "");
        const cleanPath = coverImage.startsWith("/") ? coverImage : `/${coverImage}`;
        coverImage = `${cleanBase}${cleanPath}`;
      }
    }
  }

  // Tags resolution
  let tagNames = [];
  if (options.tags) {
    tagNames = options.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  } else if (Array.isArray(frontmatter.tags)) {
    tagNames = frontmatter.tags.map((t) => String(t).trim()).filter(Boolean);
  } else if (typeof frontmatter.tags === "string") {
    tagNames = frontmatter.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // Status resolution
  const isDraft =
    options.draft ||
    frontmatter.draft ||
    frontmatter.status?.toUpperCase() === "DRAFT";
  const status = isDraft ? "DRAFT" : "PUBLISHED";

  // Cross-post flags resolution (Frontmatter + CLI options)
  const crossPostFm = frontmatter.cross_post || frontmatter.crosspost || {};
  const crossPostToDevTo =
    options.devto ?? crossPostFm.devto ?? frontmatter.crossPostToDevTo ?? true;
  const crossPostToHashnode =
    options.hashnode ??
    crossPostFm.hashnode ??
    frontmatter.crossPostToHashnode ??
    true;
  const crossPostToMedium =
    options.medium ??
    crossPostFm.medium ??
    frontmatter.crossPostToMedium ??
    false;
  const crossPostToBluesky =
    options.bluesky ??
    crossPostFm.bluesky ??
    frontmatter.crossPostToBluesky ??
    false;
  const crossPostToWordpress =
    options.wordpress ??
    crossPostFm.wordpress ??
    frontmatter.crossPostToWordpress ??
    false;

  // Additional frontmatter and options
  const categorySlug =
    options.category ||
    frontmatter.category_slug ||
    frontmatter.categorySlug ||
    frontmatter.category ||
    undefined;
  const seriesId =
    options.series ||
    frontmatter.series_id ||
    frontmatter.seriesId ||
    undefined;
  const metaTitle =
    options.metaTitle ||
    frontmatter.meta_title ||
    frontmatter.metaTitle ||
    undefined;
  const metaDescription =
    options.metaDescription ||
    frontmatter.meta_description ||
    frontmatter.metaDescription ||
    undefined;
  const ogTitle = frontmatter.og_title || frontmatter.ogTitle || undefined;
  const ogDescription =
    frontmatter.og_description || frontmatter.ogDescription || undefined;
  const generateTOC =
    options.toc ??
    frontmatter.generate_toc ??
    frontmatter.generateTOC ??
    frontmatter.toc ??
    undefined;
  const commentsEnabled =
    options.comments ??
    frontmatter.comments_enabled ??
    frontmatter.commentsEnabled ??
    true;

  // Dry-run mode
  if (options.dryRun) {
    console.log(pc.bold(pc.yellow(`\n🔍 [DRY RUN] Previewing publish payload for: "${title}"`)));
    console.log(pc.dim("No network requests will be sent and no data will be modified."));
    console.log(pc.bold("────────────────────────────────────────────────────────────"));
    console.log(`  📄 ${pc.bold("File:")}            ${pc.cyan(resolvedPath)}`);
    console.log(`  🏷️  ${pc.bold("Title:")}           ${title}`);
    if (subtitle) console.log(`  📝 ${pc.bold("Subtitle:")}        ${subtitle}`);
    if (excerpt) console.log(`  📜 ${pc.bold("Excerpt:")}         ${excerpt}`);
    console.log(`  🚦 ${pc.bold("Status:")}          ${status}`);
    if (canonicalUrl) console.log(`  🔗 ${pc.bold("Canonical URL:")}   ${pc.dim(canonicalUrl)}`);
    if (coverImage) console.log(`  🖼️  ${pc.bold("Cover Image:")}     ${pc.dim(coverImage)}`);
    if (tagNames.length > 0) console.log(`  🏷️  ${pc.bold("Tags:")}            ${tagNames.join(", ")}`);
    if (categorySlug) console.log(`  📁 ${pc.bold("Category:")}        ${categorySlug}`);
    if (seriesId) console.log(`  📚 ${pc.bold("Series ID:")}       ${seriesId}`);
    console.log(pc.bold("────────────────────────────────────────────────────────────"));
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
      const state = t.enabled ? pc.green("✓ Enabled") : pc.dim("✗ Skipped");
      console.log(`     ${t.name.padEnd(20)} ${state}`);
    });
    console.log(pc.bold("────────────────────────────────────────────────────────────\n"));
    console.log(pc.green("✨ Dry run completed successfully. Everything looks ready to publish!\n"));
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

  // Convert raw Markdown content to semantic HTML for ZyVOP's reader & editor
  let contentToParse = content;
  if (baseUrl) {
    const cleanBase = baseUrl.replace(/\/+$/, "");
    contentToParse = contentToParse.replace(
      /!\[([^\]]*)\]\(\s*(\/[^)\s]+)\s*\)/g,
      `![$1](${cleanBase}$2)`,
    );
  }
  const htmlContent = marked.parse(contentToParse);

  if (token.startsWith("zv_")) {
    try {
      const rawMarkdown = fs.readFileSync(resolvedPath, "utf-8");
      const post = await publishArticleRestApi(rawMarkdown, token, endpoint);
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
      if (isUpdated) {
        console.log(`  ⚡ ${pc.bold("Action:")}          ${pc.yellow("Updated existing article")}`);
      } else {
        console.log(`  ⚡ ${pc.bold("Action:")}          ${pc.green("Created new article")}`);
      }
      console.log(
        pc.bold(
          "────────────────────────────────────────────────────────────\n",
        ),
      );
      return;
    } catch (err) {
      spinner.fail(pc.red(`Failed to publish: ${err.message}\n`));
      process.exit(1);
    }
  }

  try {
    const post = await createPostApi(
      {
        title,
        subtitle,
        excerpt,
        content: htmlContent,
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
      },
      token,
      endpoint,
    );

    spinner.succeed(pc.green(pc.bold("Article published successfully! 🎉\n")));

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
    process.exit(1);
  }
}
