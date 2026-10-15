import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAiDisclosure,
  toDevToAiDisclosureLevel,
} from "../src/ai-disclosure.js";

test("maps every public disclosure level to GraphQL and DEV values", () => {
  const cases = [
    ["human_written", "NO_MATERIAL_AI", "no_ai"],
    ["ai_assisted", "AI_ASSISTED", "some_ai"],
    ["ai_generated", "AI_GENERATED", "fully_autonomous"],
  ];

  for (const [input, graphql, devto] of cases) {
    const parsed = parseAiDisclosure({ ai_disclosure: input });
    assert.equal(parsed.aiDisclosureLevel, graphql);
    assert.equal(toDevToAiDisclosureLevel(parsed.aiDisclosure), devto);
  }
});

test("uses DEV's not_disclosed value for legacy articles", () => {
  assert.equal(toDevToAiDisclosureLevel(undefined), "not_disclosed");
});

test("trims notes and enforces the public 500-character limit", () => {
  const parsed = parseAiDisclosure({
    ai_disclosure: "ai_assisted",
    ai_disclosure_note: "  Human reviewed.  ",
  });
  assert.equal(parsed.aiDisclosureNote, "Human reviewed.");
  assert.throws(
    () =>
      parseAiDisclosure({
        ai_disclosure: "ai_assisted",
        ai_disclosure_note: "x".repeat(501),
      }),
    /500 characters or fewer/,
  );
});
