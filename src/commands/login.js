import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import ora from "ora";
import pc from "picocolors";
import { loginApi, getMeApi } from "../api.js";
import {
  saveStoredConfig,
  resolveEndpoint,
  resolveWebUrl,
  DEFAULT_ENDPOINT,
} from "../config.js";

export async function loginCommand(options) {
  const endpoint =
    options.endpoint || process.env.ZYVOP_ENDPOINT || DEFAULT_ENDPOINT;

  // If token is directly provided via flag
  if (options.token) {
    const isDevToken = options.token.startsWith("zv_");
    if (isDevToken) {
      saveStoredConfig({
        token: options.token,
        endpoint,
        user: { username: "Developer", isDeveloperToken: true },
      });
      console.log(
        pc.green(`✔ Developer Token authenticated and saved successfully!`),
      );
      console.log(pc.dim(`Endpoint: ${endpoint}\n`));
      return;
    }

    const spinner = ora("Verifying ZyVOP token...").start();
    try {
      const user = await getMeApi(options.token, endpoint);
      if (!user) {
        spinner.fail(pc.red("Invalid token or user not found."));
        process.exit(1);
      }
      saveStoredConfig({ token: options.token, endpoint, user });
      spinner.succeed(
        pc.green(`Authenticated as ${pc.bold(user.username || user.email)}!`),
      );
      console.log(pc.dim(`Endpoint: ${endpoint}\n`));
      return;
    } catch (err) {
      spinner.fail(pc.red(`Authentication failed: ${err.message}`));
      process.exit(1);
    }
  }

  // Interactive Login
  console.log(pc.bold(pc.cyan("\n🔑 Sign in to your ZyVOP account\n")));
  console.log(
    pc.dim(
      "Tip: If you signed up via Google or GitHub, enter your Developer Token from Settings > Integrations.\n",
    ),
  );

  const rl = readline.createInterface({ input, output });

  try {
    const inputStr =
      options.email ||
      (await rl.question(pc.bold("Email or Developer Token: ")));

    const trimmed = inputStr.trim();
    const isToken =
      trimmed.startsWith("zv_") ||
      trimmed.startsWith("zyvop_") ||
      trimmed.startsWith("eyJ") ||
      (!trimmed.includes("@") && trimmed.length > 20);

    // Check if user entered a Developer Token directly
    if (isToken) {
      rl.close();
      const token = trimmed;
      const spinner = ora("Saving Developer Token...").start();
      let user = null;
      try {
        user = await getMeApi(token, endpoint);
      } catch {}

      saveStoredConfig({
        token,
        endpoint,
        user: user || { username: "Developer", isDeveloperToken: true },
      });
      spinner.succeed(pc.green(`Developer Token saved successfully!`));
      console.log(pc.dim(`Saved credentials to ~/.zyvop/config.json\n`));
      return;
    }

    const email = inputStr;
    const password =
      options.password || (await rl.question(pc.bold("Password: ")));
    rl.close();

    if (!email.trim() || !password.trim()) {
      console.log(pc.red("\nError: Email and password are required."));
      process.exit(1);
    }

    const spinner = ora("Signing in to ZyVOP...").start();
    let res;
    try {
      res = await loginApi(email.trim(), password.trim(), endpoint);
    } catch (err) {
      if (
        err.message.includes("social login") ||
        err.message.includes("Please use social login")
      ) {
        spinner.fail(
          pc.yellow(
            "This account was created via Google / GitHub Social Login.",
          ),
        );
        console.log(pc.cyan("\nHow to authenticate your CLI:"));
        console.log(
          `  1. Open your browser to ${pc.bold(resolveWebUrl("settings", endpoint))}`,
        );
        console.log("  2. Go to Integrations > ZyVOP Developer API");
        console.log("  3. Copy your Developer Token and run:");
        console.log(pc.green("     zyvop login --token <your-token>\n"));
        process.exit(1);
      }
      throw err;
    }

    if (!res || !res.accessToken) {
      spinner.fail(pc.red("Login failed: Invalid credentials."));
      process.exit(1);
    }

    // Retrieve user details with access token
    let user;
    try {
      user = await getMeApi(res.accessToken, endpoint);
    } catch {}

    saveStoredConfig({
      token: res.accessToken,
      endpoint,
      user,
    });

    spinner.succeed(
      pc.green(
        `Welcome back, ${pc.bold(user?.username || user?.name || email)}!`,
      ),
    );
    console.log(pc.dim(`Saved credentials to ~/.zyvop/config.json\n`));
  } catch (err) {
    console.log(pc.red(`\nLogin failed: ${err.message}\n`));
    process.exit(1);
  }
}
