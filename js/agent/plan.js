import { expandTokens, pushedSince, toEnglish, tokenize } from "./text.js";

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

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function withFilters(q, stars, pushed) {
  return `${q} fork:false archived:false stars:>${stars} pushed:>${pushed}`;
}

export function detectIntents(query, tokens) {
  const q = String(query).toLowerCase();
  return INTENTS.filter((intent) => intent.test(q, tokens));
}

export function buildPlan(query) {
  const raw = String(query || "").trim();
  const tokens = tokenize(raw);
  const expanded = expandTokens(tokens);
  const english = toEnglish(raw) || raw;
  const intents = detectIntents(raw, expanded);
  const pushed = pushedSince(18);
  const stars = intents.length
    ? Math.min(...intents.map((i) => i.stars))
    : 10;
  const keywords = uniq([
    ...expanded.filter((t) => !/^[\u0400-\u04ff]/.test(t)),
    ...english.split(/\s+/),
    ...intents.flatMap((i) => i.extra),
  ]).filter((t) => t.length >= 2);

  const queries = [];
  const enCore = english || keywords.slice(0, 5).join(" ");

  if (intents.length) {
    for (const intent of intents.slice(0, 2)) {
      if (intent.topics[0]) {
        const extras = uniq([enCore, ...intent.extra]).slice(0, 6).join(" ");
        queries.push(
          withFilters(`topic:${intent.topics[0]} ${extras}`, stars, pushed)
        );
      }
    }
  }

  if (intents.some((i) => i.id === "notion")) {
    queries.unshift(withFilters("notion mcp server", 8, pushed));
  }

  queries.push(withFilters(enCore, stars, pushed));

  if (intents.some((i) => i.id === "mcp") && /telegram|телеграм/i.test(raw)) {
    queries.unshift(
      withFilters("telegram mcp server", 3, pushed)
    );
  }

  if (intents.some((i) => i.id === "cursor") && /rule|правил/i.test(raw)) {
    queries.unshift(withFilters("cursorrules cursor rules", 10, pushed));
  }

  const uniqueQueries = uniq(queries).slice(0, 3);

  return {
    query: raw,
    english,
    tokens,
    expanded,
    keywords,
    intents: intents.map((i) => ({
      id: i.id,
      category: i.category,
      topics: i.topics,
    })),
    stars,
    pushed,
    queries: uniqueQueries,
  };
}

export function applyLlmPlan(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const english = String(patch.english || base.english).slice(0, 160);
  let queries = Array.isArray(patch.queries)
    ? patch.queries.map((q) => String(q).slice(0, 220)).filter(Boolean)
    : [];
  queries = queries
    .map((q) => {
      let out = q;
      if (!/fork:false/.test(out)) out += " fork:false";
      if (!/archived:false/.test(out)) out += " archived:false";
      if (!/pushed:>/.test(out)) out += ` pushed:>${base.pushed}`;
      return out.replace(/\s+/g, " ").trim();
    })
    .slice(0, 3);
  if (!queries.length) queries = base.queries;
  const keywords = Array.isArray(patch.keywords)
    ? patch.keywords.map((k) => String(k).toLowerCase()).slice(0, 16)
    : base.keywords;
  return { ...base, english, queries, keywords };
}
