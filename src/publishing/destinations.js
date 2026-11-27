const ARTICLE_FIELDS = {
  devto: "crossPostToDevTo",
  hashnode: "crossPostToHashnode",
  medium: "crossPostToMedium",
  bluesky: "crossPostToBluesky",
  wordpress: "crossPostToWordpress",
};
const LINKEDIN_FIELDS = {
  linkedin: "crossPostToLinkedin",
  "linkedin-profile": "crossPostToLinkedinProfile",
  "linkedin-page": "crossPostToLinkedinPage",
};

export function normalizeDestinations(frontmatter, options = {}) {
  const settings =
    frontmatter.cross_post && typeof frontmatter.cross_post === "object"
      ? frontmatter.cross_post
      : frontmatter.crosspost && typeof frontmatter.crosspost === "object"
        ? frontmatter.crosspost
        : {};
  const result = {};
  for (const [platform, field] of Object.entries(ARTICLE_FIELDS)) {
    result[platform] =
      options[platform] ??
      settings[platform] ??
      frontmatter[field] ??
      ["devto", "hashnode"].includes(platform);
  }
  for (const [platform, field] of Object.entries(LINKEDIN_FIELDS)) {
    const value = settings[platform] ?? frontmatter[field];
    if (value !== undefined) result[platform] = value;
  }
  for (const [platform, enabled] of Object.entries(result)) {
    if (typeof enabled !== "boolean")
      throw new Error(`cross_post.${platform} must be true or false.`);
  }
  return result;
}

export function linkedinPublishFields(payload, enabled = true) {
  const result = {};
  for (const [platform, field] of Object.entries(LINKEDIN_FIELDS)) {
    if (payload.crossPost[platform] !== undefined)
      result[field] = enabled && payload.crossPost[platform];
  }
  for (const field of ["linkedinProfileCaption", "linkedinPageCaption"]) {
    const value = payload.normalizedFrontmatter[field];
    if (value !== undefined) result[field] = value;
  }
  return result;
}

export function normalizeLinkedinCaptions(frontmatter) {
  const result = {};
  for (const field of ["linkedinProfileCaption", "linkedinPageCaption"]) {
    const value = frontmatter[field];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") {
      throw new Error(`${field} must be a string or null.`);
    }
    const caption = value?.trim() || null;
    if (caption && caption.length > 2500) {
      throw new Error(`${field} must be 2,500 characters or fewer.`);
    }
    result[field] = caption;
  }
  return result;
}

export function assertLinkedinPublishingMode(crossPost, local) {
  if (
    local &&
    Object.keys(LINKEDIN_FIELDS).some((platform) => crossPost[platform])
  ) {
    throw new Error(
      "LinkedIn profile and company Page publishing use your ZyVOP connections. Remove --local to send to LinkedIn.",
    );
  }
}

export function disabledLinkedinFlags(data) {
  const nested = data.cross_post || data.crosspost || {};
  return Object.fromEntries(
    Object.entries(LINKEDIN_FIELDS)
      .filter(
        ([platform, field]) =>
          nested[platform] !== undefined || data[field] !== undefined,
      )
      .map(([platform]) => [platform, false]),
  );
}
