import ora from "ora";
import pc from "picocolors";
import { getMyIntegrationsApi } from "../../api.js";
import {
  crossPostLocally,
  requestedLocalPlatforms,
} from "../../local-cross-post.js";

const PLATFORM_LABELS = {
  devto: "dev.to",
  hashnode: "Hashnode",
  medium: "Medium",
  bluesky: "Bluesky",
  wordpress: "WordPress",
};

function redactLocalError(message, credentials) {
  let redacted = String(message || "Unknown provider error");
  for (const providerCredentials of Object.values(credentials)) {
    for (const value of Object.values(providerCredentials || {})) {
      if (typeof value === "string" && value.length >= 4) {
        redacted = redacted.split(value).join("[REDACTED]");
      }
    }
  }
  return redacted;
}

export async function renderSyndication({
  options,
  payload,
  post,
  liveUrl,
  localCredentials,
  token,
  endpoint,
  status,
}) {
  const crossPost = payload.crossPost;
  const crossPostToDevTo = payload.crossPost.devto;
  const crossPostToHashnode = payload.crossPost.hashnode;
  const crossPostToMedium = payload.crossPost.medium;
  const crossPostToBluesky = payload.crossPost.bluesky;
  const crossPostToWordpress = payload.crossPost.wordpress;

  if (status !== "PUBLISHED") {
    const label = options.local ? "Local syndication:" : "Syndication:";
    console.log(
      `  📡 ${pc.bold(label)} ${pc.dim(`Skipped for ${status.toLowerCase()} article`)}`,
    );
    console.log(
      pc.bold("────────────────────────────────────────────────────────────\n"),
    );
    return;
  }

  if (options.local) {
    const localPlatforms = requestedLocalPlatforms(crossPost);
    if (localPlatforms.length === 0) {
      console.log(
        `  📡 ${pc.bold("Local syndication:")} ${pc.dim("No targets selected")}`,
      );
      console.log(
        pc.bold(
          "────────────────────────────────────────────────────────────\n",
        ),
      );
      return;
    }

    const localSpinner = ora(
      "Publishing directly to local-credential targets...",
    ).start();
    const results = await crossPostLocally({
      payload,
      zyvopPost: post,
      liveUrl,
      credentials: localCredentials,
    });
    const failures = results.filter((result) => !result.success);
    if (failures.length > 0) {
      localSpinner.warn(pc.yellow("Local syndication completed with errors."));
    } else {
      localSpinner.succeed(pc.green("Local syndication completed."));
    }
    for (const result of results) {
      const label = PLATFORM_LABELS[result.platform] || result.platform;
      if (result.success) {
        console.log(
          `  ${label.padEnd(20)} ${pc.green(result.action || "Published")}${
            result.url ? pc.dim(` (${result.url})`) : ""
          }`,
        );
      } else {
        console.log(
          `  ${label.padEnd(20)} ${pc.red("Failed")} ${pc.dim(
            `(${redactLocalError(result.error, localCredentials)})`,
          )}`,
        );
      }
    }
    console.log(
      pc.bold("────────────────────────────────────────────────────────────\n"),
    );
    if (failures.length > 0) process.exitCode = 1;
    return;
  }

  // Check integrations for actionable terminal feedback
  let integrations = null;
  try {
    integrations = await getMyIntegrationsApi(token, endpoint);
  } catch {}

  // Render Clean Success Card
  const errors = post.crossPostErrors || {};

  const renderTarget = (
    label,
    enabled,
    url,
    errKey,
    hasKey,
    pending = "Queued & Synced",
    missing = "Missing API key in Settings > Integrations",
  ) => {
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
        `  ${label.padEnd(20)} ${pc.yellow("Warning")} ${pc.dim(`(${missing})`)}`,
      );
    } else {
      console.log(`  ${label.padEnd(20)} ${pc.green(pending)}`);
    }
  };

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
  for (const [key, label, url, connected] of [
    [
      "linkedin",
      "LinkedIn (saved):",
      post.linkedinPostUrl,
      integrations?.hasLinkedinIntegration,
    ],
    [
      "linkedin-profile",
      "LinkedIn profile:",
      post.linkedinProfilePostUrl,
      integrations?.hasLinkedinProfileIntegration,
    ],
    [
      "linkedin-page",
      "LinkedIn company:",
      post.linkedinPagePostUrl,
      integrations?.hasLinkedinPageIntegration,
    ],
  ]) {
    renderTarget(
      label,
      crossPost[key],
      url,
      key,
      connected,
      "Queued",
      "Connect this LinkedIn destination in Settings > Integrations (company Pages require Pro)",
    );
  }
  console.log(
    pc.bold("────────────────────────────────────────────────────────────\n"),
  );
}
