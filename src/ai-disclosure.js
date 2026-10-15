const DISCLOSURE_LEVELS = {
  human_written: {
    graphql: "NO_MATERIAL_AI",
    devto: "no_ai",
    label: "Human-written",
  },
  ai_assisted: {
    graphql: "AI_ASSISTED",
    devto: "some_ai",
    label: "AI-assisted",
  },
  ai_generated: {
    graphql: "AI_GENERATED",
    devto: "fully_autonomous",
    label: "AI-generated",
  },
};

const DISCLOSURE_ALIASES = {
  no_material_ai: "human_written",
  no_ai: "human_written",
  some_ai: "ai_assisted",
  fully_autonomous: "ai_generated",
};

function optionalNote(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error("ai_disclosure_note must be a string.");
  }
  const note = value.trim();
  if (note.length > 500) {
    throw new Error("ai_disclosure_note must be 500 characters or fewer.");
  }
  return note || undefined;
}

export function parseAiDisclosure(frontmatter = {}) {
  const rawLevel = frontmatter.ai_disclosure ?? frontmatter.aiDisclosure;
  const rawNote =
    frontmatter.ai_disclosure_note ?? frontmatter.aiDisclosureNote;
  const rawReview =
    frontmatter.ai_review_confirmed ?? frontmatter.aiReviewConfirmed;

  let aiDisclosure;
  if (rawLevel !== undefined && rawLevel !== null && rawLevel !== "") {
    if (typeof rawLevel !== "string") {
      throw new Error("ai_disclosure must be a string.");
    }
    const normalized = rawLevel.trim().toLowerCase().replace(/[\s-]+/g, "_");
    aiDisclosure = DISCLOSURE_ALIASES[normalized] || normalized;
    if (!DISCLOSURE_LEVELS[aiDisclosure]) {
      throw new Error(
        "ai_disclosure must be human_written, ai_assisted, or ai_generated.",
      );
    }
  }

  if (rawReview !== undefined && typeof rawReview !== "boolean") {
    throw new Error("ai_review_confirmed must be true or false.");
  }

  const level = aiDisclosure ? DISCLOSURE_LEVELS[aiDisclosure] : undefined;
  return {
    aiDisclosure,
    aiDisclosureLevel: level?.graphql,
    aiDisclosureNote: optionalNote(rawNote),
    aiReviewConfirmed: rawReview,
    aiDisclosureLabel: level?.label || "Not declared",
  };
}

export function toDevToAiDisclosureLevel(aiDisclosure) {
  return DISCLOSURE_LEVELS[aiDisclosure]?.devto || "not_disclosed";
}
