// Every word whack() can return, grouped into six inks. whack.ts doesn't export its list,
// so anything missing here is drawn in NEUTRAL and logged as a warning.
export const CATEGORIES = {
  event: { name: "The event", color: "#2b4fb3", words: ["whack", "hack", "warwick", "oculus", "compsoc"] },
  sponsor: { name: "Sponsors", color: "#946600", words: ["marshall", "wace", "brevan", "howard", "capital", "one", "bloomberg", "netcraft", "incident", "io"] },
  bird: { name: "Ducks and geese", color: "#0f7a6c", words: ["duck", "quack", "goose", "honk", "rubber"] },
  bug: { name: "Bugs and errors", color: "#c4262e", words: ["bug", "feature", "segfault", "null", "pointer", "stack", "overflow", "semicolon"] },
  git: { name: "Git and shipping", color: "#6a3fb5", words: ["deploy", "merge", "conflict", "commit", "push", "prod"] },
  life: { name: "Hackathon life", color: "#c0560f", words: ["pizza", "coffee", "sleep", "demo", "pitch", "prize", "midnight", "wifi"] },
} as const;

export type Category = keyof typeof CATEGORIES;
export const NEUTRAL = "#4a4d55";

export const CATEGORY_OF: Record<string, Category> = Object.fromEntries(
  Object.entries(CATEGORIES).flatMap(([cat, { words }]) => words.map(w => [w, cat as Category])),
);
