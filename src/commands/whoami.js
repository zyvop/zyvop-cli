import ora from "ora";
import pc from "picocolors";
import { getMeApi, getMyIntegrationsApi } from "../api.js";
import {
  resolveAuthToken,
  resolveEndpoint,
  clearStoredConfig,
} from "../config.js";

export async function whoamiCommand(options) {
  const token = resolveAuthToken(options.token);
  const endpoint = resolveEndpoint(options.endpoint);

  if (!token) {
    console.log(pc.yellow("\nYou are not logged in to ZyVOP."));
    console.log(pc.dim("Run `zyvop login` to authenticate.\n"));
    return;
  }

  const spinner = ora("Checking ZyVOP session...").start();
  try {
    let user = null;
    try {
      user = await getMeApi(token, endpoint);
    } catch {}

    if (!user) {
      spinner.succeed(pc.green("Authenticated with Developer Token:"));
      console.log(`  ${pc.bold("Token:")}    ${token.slice(0, 14)}...`);
      console.log(`  ${pc.bold("Endpoint:")} ${pc.dim(endpoint)}\n`);
      return;
    }

    let integrations = null;
    try {
      integrations = await getMyIntegrationsApi(token, endpoint);
    } catch {}

    spinner.succeed(pc.green("Authenticated session active:"));
    console.log(`  ${pc.bold("Username:")} ${user.username}`);
    console.log(`  ${pc.bold("Email:")}    ${user.email}`);
    if (user.name) console.log(`  ${pc.bold("Name:")}     ${user.name}`);
    console.log(`  ${pc.bold("Endpoint:")} ${pc.dim(endpoint)}`);

    if (integrations) {
      console.log(pc.bold("\n  Cross-Posting Integrations:"));
      console.log(
        `    ⚡ dev.to:     ${integrations.hasDevToApiKey ? pc.green("Configured ✓") : pc.dim("Not Configured")}`,
      );
      console.log(
        `    🚀 Hashnode:   ${integrations.hasHashnodeApiKey ? pc.green("Configured ✓") : pc.dim("Not Configured")}`,
      );
      console.log(
        `    ✍️  Medium:     ${integrations.hasMediumApiKey ? pc.green("Configured ✓") : pc.dim("Not Configured")}`,
      );
      console.log(
        `    🦋 Bluesky:    ${integrations.hasBlueskyIntegration ? pc.green("Configured ✓") : pc.dim("Not Configured")}`,
      );
      console.log(
        `    📝 WordPress:  ${integrations.hasWordpressIntegration ? pc.green("Configured ✓") : pc.dim("Not Configured")}`,
      );
    }
    console.log();
  } catch (err) {
    spinner.fail(pc.red(`Failed to verify session: ${err.message}\n`));
  }
}

export async function logoutCommand() {
  clearStoredConfig();
  console.log(pc.green("\nSuccessfully logged out of ZyVOP.\n"));
}
