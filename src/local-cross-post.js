import { clean, wordpressBaseUrl } from "./publishing/local/helpers.js";
import {
  publishToDevTo,
  publishToHashnode,
  publishToMedium,
  publishToWordpress,
  publishToBluesky,
} from "./publishing/local/providers.js";
export {
  publishToDevTo,
  publishToHashnode,
  publishToMedium,
  publishToWordpress,
  publishToBluesky,
} from "./publishing/local/providers.js";
export { disableServerCrossPosting } from "./publishing/local/frontmatter.js";

const ALL_PLATFORMS = ["devto", "hashnode", "medium", "bluesky", "wordpress"];

const CREDENTIAL_SPECS = {
  devto: ["ZYVOP_DEVTO_API_KEY"],
  hashnode: ["ZYVOP_HASHNODE_API_KEY"],
  medium: ["ZYVOP_MEDIUM_API_TOKEN"],
  bluesky: ["ZYVOP_BLUESKY_IDENTIFIER", "ZYVOP_BLUESKY_APP_PASSWORD"],
  wordpress: [
    "ZYVOP_WORDPRESS_URL",
    "ZYVOP_WORDPRESS_USERNAME",
    "ZYVOP_WORDPRESS_APP_PASSWORD",
  ],
};

export function requestedLocalPlatforms(crossPost) {
  return ALL_PLATFORMS.filter((platform) => crossPost?.[platform] === true);
}

export function resolveLocalCredentials(platform, env = process.env) {
  const missing = (CREDENTIAL_SPECS[platform] || []).filter(
    (name) => !clean(env[name]),
  );
  if (missing.length > 0) {
    throw new Error(`${platform}: missing ${missing.join(", ")}`);
  }

  switch (platform) {
    case "devto":
      return { apiKey: clean(env.ZYVOP_DEVTO_API_KEY) };
    case "hashnode":
      return {
        apiKey: clean(env.ZYVOP_HASHNODE_API_KEY)?.replace(/^Bearer\s+/i, ""),
      };
    case "medium":
      return { apiToken: clean(env.ZYVOP_MEDIUM_API_TOKEN) };
    case "bluesky":
      return {
        identifier: clean(env.ZYVOP_BLUESKY_IDENTIFIER),
        appPassword: clean(env.ZYVOP_BLUESKY_APP_PASSWORD),
      };
    case "wordpress":
      return {
        url: wordpressBaseUrl(clean(env.ZYVOP_WORDPRESS_URL)),
        username: clean(env.ZYVOP_WORDPRESS_USERNAME),
        appPassword: clean(env.ZYVOP_WORDPRESS_APP_PASSWORD),
      };
    default:
      throw new Error(`Unsupported local platform: ${platform}`);
  }
}

export function resolveAllLocalCredentials(crossPost, env = process.env) {
  const credentials = {};
  const errors = [];
  for (const platform of requestedLocalPlatforms(crossPost)) {
    try {
      credentials[platform] = resolveLocalCredentials(platform, env);
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `Local credentials are incomplete:\n  - ${errors.join("\n  - ")}`,
    );
  }
  return credentials;
}

const LOCAL_PUBLISHERS = {
  devto: publishToDevTo,
  hashnode: publishToHashnode,
  medium: publishToMedium,
  bluesky: publishToBluesky,
  wordpress: publishToWordpress,
};

export async function crossPostLocally({
  payload,
  zyvopPost,
  liveUrl,
  credentials,
}) {
  const canonicalUrl = payload.canonicalUrl || liveUrl;
  if (!canonicalUrl)
    throw new Error("Local cross-posting requires a canonical or ZyVOP URL.");
  const context = { payload, zyvopPost, canonicalUrl };
  return Promise.all(
    requestedLocalPlatforms(payload.crossPost).map(async (platform) => {
      try {
        const result = await LOCAL_PUBLISHERS[platform](
          context,
          credentials[platform],
        );
        return { ...result, success: true };
      } catch (error) {
        return {
          platform,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}
