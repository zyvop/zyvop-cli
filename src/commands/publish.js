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
  const coverImage =
    options.cover ||
    frontmatter.cover_image ||
    frontmatter.coverImage ||
    frontmatter.image ||
    undefined;
  const canonicalUrl =
    options.canonical ||
    frontmatter.canonical_url ||
    frontmatter.canonicalUrl ||
    undefined;

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
  const htmlContent = marked.parse(content);

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

  if (token.startsWith("zv_")) {
    try {
      const rawMarkdown = fs.readFileSync(resolvedPath, "utf-8");
      const post = await publishArticleRestApi(rawMarkdown, token, endpoint);
      spinner.succeed(
        pc.green(pc.bold("Article published successfully! 🎉\n")),
      );
      const liveUrl = post.url || resolveWebUrl(post.slug, endpoint);
      console.log(
        pc.bold("────────────────────────────────────────────────────────────"),
      );
      console.log(`  🌐 ${pc.bold("ZyVOP Live URL:")}  ${pc.cyan(liveUrl)}`);
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
