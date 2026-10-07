const INTENTS = [
  {
    id: "chrome",
    test: (q, t) =>
      /chrome|хром|браузер|nanobrowser|extension|расширен/.test(q) ||
      t.includes("chrome") ||
      t.includes("extension"),
    topics: ["chrome-extension"],
    extra: ["ai", "agent", "browser"],
    category: "browser",
    stars: 10,
  },
  {
    id: "telegram",
    test: (q, t) => /telegram|телеграм/.test(q) || t.includes("telegram"),
    topics: ["mcp-server"],
    extra: ["telegram", "mcp"],
    category: "mcp",
    stars: 5,
  },
  {
    id: "notion",
    test: (q, t) => /notion|ноушен/.test(q) || t.includes("notion"),
    topics: ["mcp-server"],
    extra: ["notion", "mcp"],
    category: "mcp",
    stars: 8,
  },
  {
    id: "cursor",
    test: (q, t) => /cursor|cursorrules/.test(q) || t.includes("cursor"),
    topics: ["cursor"],
    extra: ["rules", "cursorrules"],
    category: "cursor",
    stars: 10,
  },
  {
    id: "obsidian",
    test: (q, t) => /obsidian|заметк|vault/.test(q) || t.includes("obsidian"),
    topics: ["obsidian-plugin"],
    extra: ["plugin", "ai", "copilot"],
    category: "obsidian",
    stars: 10,
  },
  {
    id: "mcp",
    test: (q, t) => /\bmcp\b|model context/.test(q) || t.includes("mcp"),
    topics: ["mcp-server"],
    extra: ["mcp", "server"],
    category: "mcp",
    stars: 5,
  },
  {
    id: "skill",
    test: (q, t) => /skill|навык|adhd|свдг/.test(q) || t.includes("skill"),
    topics: [],
    extra: ["skill", "cursor"],
    category: "skill",
    stars: 5,
  },
];

export function detectIntents(query, tokens) {
  const q = String(query).toLowerCase();
  return INTENTS.filter((intent) => intent.test(q, tokens));
}
