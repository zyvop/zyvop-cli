import { parseFrontmatter, stringifyFrontmatter } from "../../frontmatter.js";
import { disabledLinkedinFlags } from "../destinations.js";
const ALL_PLATFORMS = ["devto", "hashnode", "medium", "bluesky", "wordpress"];

export function disableServerCrossPosting(normalizedMarkdown) {
  const parsed = parseFrontmatter(normalizedMarkdown);
  const data = { ...parsed.data };
  data.cross_post = Object.fromEntries([
    ...ALL_PLATFORMS.map((platform) => [platform, false]),
    ...Object.entries(disabledLinkedinFlags(data)),
  ]);
  data.crossPostToDevTo = false;
  data.crossPostToHashnode = false;
  data.crossPostToMedium = false;
  data.crossPostToBluesky = false;
  data.crossPostToWordpress = false;
  data.crossPostToLinkedin = false;
  data.crossPostToLinkedinProfile = false;
  data.crossPostToLinkedinPage = false;
  data.syndication_mode = "local";
  return stringifyFrontmatter(parsed.content, data);
}
