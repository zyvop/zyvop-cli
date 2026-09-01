#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "node:module";
import pc from "picocolors";
import { loginCommand } from "../src/commands/login.js";
import { whoamiCommand, logoutCommand } from "../src/commands/whoami.js";
import { publishCommand } from "../src/commands/publish.js";
import { importCommand } from "../src/commands/import.js";

const program = new Command();
const require = createRequire(import.meta.url);
const { version } = require("../package.json");

program
  .name("zyvop")
  .description(
    pc.bold(pc.cyan("ZyVOP CLI")) +
      " — Write once in Markdown and cross-post to dev.to, Hashnode, Medium & Bluesky.",
  )
  .version(version, "-v, --version", "Output the current version of ZyVOP CLI");

// 1. login
program
  .command("login")
  .description("Sign in to your ZyVOP account")
  .option("-e, --email <email>", "ZyVOP account email")
  .option("-p, --password <password>", "ZyVOP account password")
  .option("-t, --token <token>", "Set API token directly")
  .option("--endpoint <url>", "Custom GraphQL endpoint")
  .action(loginCommand);

// 2. whoami
program
  .command("whoami")
  .description("Check current authenticated user and session status")
  .option("-t, --token <token>", "Override API token")
  .option("--endpoint <url>", "Custom GraphQL endpoint")
  .action(whoamiCommand);

// 3. logout
program
  .command("logout")
  .description("Log out and clear stored credentials")
  .action(logoutCommand);

// 4. publish
program
  .command("publish <file>")
  .description(
    "Publish a Markdown file to ZyVOP and connected cross-posting targets",
  )
  .option("--title <title>", "Override post title")
  .option("--subtitle <subtitle>", "Post subtitle / description")
  .option(
    "--tags <tags>",
    'Comma-separated tags (e.g. "react,nextjs,typescript")',
  )
  .option(
    "--category <slug>",
    'Category slug (e.g. "frontend", "backend", "devops")',
  )
  .option("--series <seriesId>", "Series ID to attach this article to")
  .option("--cover <url>", "Cover image URL")
  .option("--canonical <url>", "Custom canonical URL")
  .option(
    "--base-url <url>",
    "Base URL for resolving relative images and asset links",
  )
  .option(
    "-d, --dry-run",
    "Validate and preview the local payload without authentication or publishing",
  )
  .option("--toc", "Enable generated Table of Contents")
  .option("--draft", "Publish as a Draft instead of public")
  .option("--devto", "Force enable cross-posting to dev.to")
  .option("--no-devto", "Disable cross-posting to dev.to")
  .option("--hashnode", "Force enable cross-posting to Hashnode")
  .option("--no-hashnode", "Disable cross-posting to Hashnode")
  .option("--medium", "Enable cross-posting to Medium")
  .option("--no-medium", "Disable cross-posting to Medium")
  .option("--bluesky", "Broadcast article link to Bluesky")
  .option("--no-bluesky", "Disable Bluesky broadcast")
  .option("--wordpress", "Enable cross-posting to WordPress")
  .option("-t, --token <token>", "ZyVOP API token or env ZYVOP_TOKEN")
  .option("--endpoint <url>", "Custom GraphQL endpoint")
  .action(publishCommand);

// 5. import
program
  .command("import <source> <identifier>")
  .description(
    "Import existing articles from dev.to, Hashnode, or RSS (e.g. `zyvop import devto username`)",
  )
  .option("-t, --token <token>", "ZyVOP API token")
  .option("--endpoint <url>", "Custom GraphQL endpoint")
  .action(importCommand);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
