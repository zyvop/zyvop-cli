import pc from "picocolors";

export function renderPublishPreview(payload, options, resolvedPath) {
  const {
    title,
    subtitle,
    excerpt,
    canonicalUrl,
    coverImage,
    tagNames,
    status,
    categorySlug,
    seriesId,
    postId,
    slug,
    resolvedAssetCount,
    aiDisclosureLabel,
  } = payload;
  const crossPostToDevTo = payload.crossPost.devto;
  const crossPostToHashnode = payload.crossPost.hashnode;
  const crossPostToMedium = payload.crossPost.medium;
  const crossPostToBluesky = payload.crossPost.bluesky;
  const crossPostToWordpress = payload.crossPost.wordpress;

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
  if (subtitle) console.log(`  📝 ${pc.bold("Subtitle:")}        ${subtitle}`);
  if (excerpt) console.log(`  📜 ${pc.bold("Excerpt:")}         ${excerpt}`);
  console.log(`  🚦 ${pc.bold("Status:")}          ${status}`);
  console.log(`  🤖 ${pc.bold("AI disclosure:")}   ${aiDisclosureLabel}`);
  if (canonicalUrl)
    console.log(`  🔗 ${pc.bold("Canonical URL:")}   ${pc.dim(canonicalUrl)}`);
  if (coverImage)
    console.log(`  🖼️  ${pc.bold("Cover Image:")}     ${pc.dim(coverImage)}`);
  if (tagNames.length > 0)
    console.log(`  🏷️  ${pc.bold("Tags:")}            ${tagNames.join(", ")}`);
  if (categorySlug)
    console.log(`  📁 ${pc.bold("Category:")}        ${categorySlug}`);
  if (seriesId) console.log(`  📚 ${pc.bold("Series ID:")}       ${seriesId}`);
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
  if (options.local) {
    console.log(
      pc.dim(
        "     Mode                 Local (provider credentials stay on this machine)",
      ),
    );
  }
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
}
