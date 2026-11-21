import pc from "picocolors";
import { resolveWebUrl } from "../../config.js";

export function publishSuccessMessage(status, action) {
  if (status === "DRAFT") return "Draft saved successfully! 📝\n";
  if (status === "SCHEDULED") return "Article scheduled successfully! 🕒\n";
  return action === "updated"
    ? "Article updated successfully! 🔄\n"
    : "Article published successfully! 🎉\n";
}

export function renderZyvopResult(post, action, liveUrl, endpoint, status) {
  const isPublished = status === "PUBLISHED";
  const label = isPublished ? "ZyVOP Live URL:" : "ZyVOP Editor URL:";
  const url = isPublished
    ? liveUrl
    : resolveWebUrl(`${encodeURIComponent(post.slug)}/edit`, endpoint);
  console.log(
    pc.bold("────────────────────────────────────────────────────────────"),
  );
  console.log(`  🌐 ${pc.bold(label)}  ${pc.cyan(url)}`);
  console.log(`  🚦 ${pc.bold("Status:")}          ${status}`);
  if (post.id) console.log(`  🆔 ${pc.bold("ZyVOP Post ID:")}   ${post.id}`);
  console.log(
    `  ⚡ ${pc.bold("Action:")}          ${
      action === "updated"
        ? pc.yellow("Updated existing article")
        : pc.green("Created new article")
    }`,
  );
}
