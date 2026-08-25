import ora from "ora";
import pc from "picocolors";
import { importPostsApi } from "../api.js";
import { resolveAuthToken, resolveEndpoint } from "../config.js";

export async function importCommand(source, identifier, options) {
  const token = resolveAuthToken(options.token);
  const endpoint = resolveEndpoint(options.endpoint);

  if (!token) {
    console.log(pc.red("\nError: You are not logged in."));
    console.log(pc.yellow("Run `zyvop login` to authenticate.\n"));
    process.exit(1);
  }

  const validSources = ["devto", "hashnode", "rss", "medium"];
  const normalizedSource = source.toLowerCase().replace(/[-._]/g, "");

  if (!validSources.includes(normalizedSource)) {
    console.log(pc.red(`\nError: Invalid source '${source}'.`));
    console.log(pc.dim("Supported sources: devto, hashnode, rss, medium\n"));
    process.exit(1);
  }

  if (!identifier || !identifier.trim()) {
    console.log(
      pc.red("\nError: Please provide a username or feed URL to import from."),
    );
    console.log(pc.dim("Example: `zyvop import devto myusername`\n"));
    process.exit(1);
  }

  const spinner = ora(
    `Importing articles from ${source} (${identifier})...`,
  ).start();

  try {
    const count = await importPostsApi(
      normalizedSource,
      identifier.trim(),
      token,
      endpoint,
    );
    spinner.succeed(
      pc.green(
        pc.bold(`Successfully imported ${count || 0} articles to ZyVOP! 🚀\n`),
      ),
    );
    console.log(
      pc.dim(
        "Your imported posts are now saved in your ZyVOP dashboard with canonical URLs intact.\n",
      ),
    );
  } catch (err) {
    spinner.fail(pc.red(`Import failed: ${err.message}\n`));
    process.exit(1);
  }
}
