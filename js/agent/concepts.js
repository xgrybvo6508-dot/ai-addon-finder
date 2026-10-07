import { FILLERS, normalize, tokenize } from "./text.js";

/**
 * Phrase → technical concept. Longer patterns should come first.
 * `terms` are English GitHub-search tokens. `label` is shown on chips.
 */
export const CONCEPTS = [
  {
    id: "knowledge-graph",
    label: "граф знаний",
    weight: 4,
    terms: [
      "knowledge graph",
      "graphrag",
      "graph memory",
      "graph-based",
      "knowledge-graph",
    ],
    patterns: [
      /граф(?:а|е|ом|у|ы)?(?:\s+знан)?/,
      /knowledge[\s-]?graph/,
      /graphrag/,
      /graph[\s-]?rag/,
      /граф[\s-]?пам/,
    ],
  },
  {
    id: "token-efficiency",
    label: "экономия токенов",
    weight: 4,
    terms: [
      "token",
      "context compression",
      "token efficient",
      "context window",
      "graphrag",
    ],
    patterns: [
      /экономи[тл].{0,12}токен/,
      /экономия токен/,
      /токен/,
      /save[s]? tokens?/,
      /token[-\s]?efficien/,
      /fewer tokens?/,
      /context compression/,
      /compress(?:es|ing)? context/,
    ],
  },
  {
    id: "sequential-planning",
    label: "последовательное планирование",
    weight: 3,
    terms: ["langgraph", "agent planner", "step-by-step", "workflow graph", "planning"],
    patterns: [
      /последовательн/,
      /шаг за шагом/,
      /step[-\s]?by[-\s]?step/,
      /planner|planning graph/,
      /langgraph/,
      /state graph/,
      /граф.{0,16}план/,
    ],
  },
  {
    id: "self-building",
    label: "сам строит граф",
    weight: 3,
    terms: ["auto-generated", "self-building", "automatic graph", "graph construction"],
    patterns: [
      /сам(?:а|и)?\s+(?:созда|стро|генерир)/,
      /самостоятельн.{0,12}(?:созда|стро)/,
      /auto[-\s]?generat/,
      /self[-\s]?build/,
      /builds? (?:its )?own graph/,
    ],
  },
  {
    id: "memory",
    label: "память агента",
    weight: 3,
    terms: ["memory", "agent memory", "long-term memory", "mem0", "graphiti"],
    patterns: [
      /запомина/,
      /памят/,
      /\bmemory\b/,
      /remember/,
      /long[-\s]?term memory/,
    ],
  },
  {
    id: "notes-linking",
    label: "связи между заметками",
    weight: 3,
    terms: ["related notes", "backlinks", "semantic links", "smart connections"],
    patterns: [
      /связ(?:и|ей|ь)/,
      /предлагал.{0,16}связ/,
      /related notes/,
      /backlinks?/,
      /smart connections/,
    ],
  },
  {
    id: "obsidian",
    label: "Obsidian",
    weight: 3,
    terms: ["obsidian", "obsidian plugin", "vault"],
    patterns: [/obsidian/, /хранилищ/, /\bvault\b/, /заметк/],
  },
  {
    id: "telegram",
    label: "Telegram",
    weight: 3,
    terms: ["telegram", "telegram bot", "telegram mcp"],
    patterns: [/телеграм/, /telegram/],
  },
  {
    id: "digest",
    label: "дайджест / саммари",
    weight: 3,
    terms: ["digest", "summary", "summarize", "newsletter"],
    patterns: [
      /дайджест/,
      /саммари/,
      /сводк/,
      /пересказ/,
      /summar/,
      /digest/,
    ],
  },
  {
    id: "channel-read",
    label: "читает канал",
    weight: 2,
    terms: ["channel", "read messages", "telegram channel"],
    patterns: [/канал/, /channel/, /читает.{0,12}(?:канал|чат|лент)/, /read(?:s|ing)? (?:the )?channel/],
  },
  {
    id: "browser-agent",
    label: "браузерный агент",
    weight: 4,
    terms: ["browser agent", "browser-use", "nanobrowser", "playwright"],
    patterns: [
      /браузер/,
      /browser agent/,
      /browser[-\s]?use/,
      /nanobrowser/,
      /клик/,
      /click(?:s|ing)?/,
    ],
  },
  {
    id: "form-fill",
    label: "заполняет формы",
    weight: 3,
    terms: ["form fill", "fill forms", "web automation"],
    patterns: [
      /заполн.{0,12}форм/,
      /fill(?:s|ing)? forms?/,
      /form fill/,
      /автозаполн/,
      /\bforms?\b/,
      /форм/,
    ],
  },
  {
    id: "codebase-graph",
    label: "граф кодовой базы",
    weight: 4,
    terms: ["codebase graph", "repo map", "code graph", "repository graph"],
    patterns: [
      /граф.{0,16}(?:код|репозитор|проект)/,
      /code(?:base)?[\s-]?graph/,
      /graph.{0,24}code(?:base)?/,
      /codebase.{0,20}graph/,
      /repo(?:sitory)? map/,
      /code knowledge graph/,
    ],
  },
  {
    id: "context-for-agent",
    label: "контекст для агента",
    weight: 2,
    terms: ["cursor context", "code context", "relevant files"],
    patterns: [
      /контекст/,
      /\bcontext\b/,
      /relevant files/,
      /только нужн/,
    ],
  },
  {
    id: "rag",
    label: "RAG",
    weight: 2,
    terms: ["rag", "retrieval", "vector search", "embeddings"],
    patterns: [/\brag\b/, /retriev/, /эмбедд/, /embedding/, /vector (?:search|store|db)/],
  },
  {
    id: "mcp",
    label: "MCP",
    weight: 2,
    terms: ["mcp", "mcp server", "model context protocol"],
    patterns: [/\bmcp\b/, /model context protocol/],
  },
  {
    id: "plugin",
    label: "плагин",
    weight: 1,
    terms: ["plugin", "addon"],
    patterns: [/плагин/, /\bplugins?\b/, /аддон/, /addon/],
  },
  {
    id: "extension",
    label: "расширение",
    weight: 2,
    terms: ["chrome extension", "browser extension"],
    patterns: [/расширен/, /extension/, /хром/, /chrome/],
  },
  {
    id: "library",
    label: "библиотека",
    weight: 1,
    terms: ["library", "framework", "sdk"],
    patterns: [/библиотек/, /\blibrary\b/, /фреймворк/, /framework/],
  },
  {
    id: "cursor",
    label: "Cursor",
    weight: 2,
    terms: ["cursor", "cursorrules"],
    patterns: [/cursor/, /cursorrules/],
  },
  {
    id: "notion",
    label: "Notion",
    weight: 2,
    terms: ["notion", "notion mcp"],
    patterns: [/notion/, /ноушен/],
  },
  {
    id: "n8n",
    label: "n8n / автоматизация",
    weight: 2,
    terms: ["n8n", "workflow automation"],
    patterns: [/n8n/, /автоматизац/, /workflow/],
  },
  {
    id: "agent",
    label: "агент",
    weight: 1,
    terms: ["agent", "autonomous agent"],
    patterns: [/агент/, /\bagents?\b/, /autonomous/],
  },
  {
    id: "llm",
    label: "нейросеть",
    weight: 1,
    terms: ["llm", "ai"],
    patterns: [/нейросет/, /\bllm\b/, /\bии\b/, /\bai\b/],
  },
];

const ARTIFACTS = [
  { id: "plugin", category: "obsidian", test: /плагин|plugin|addon/ },
  { id: "mcp", category: "mcp", test: /\bmcp\b|model context/ },
  { id: "extension", category: "browser", test: /расширен|extension|хром|chrome/ },
  { id: "library", category: "catalog", test: /библиотек|library|framework|langgraph|sdk/ },
];

function compile() {
  return CONCEPTS.map((c) => ({
    ...c,
    rx: c.patterns.map((p) => new RegExp(p.source, p.flags.includes("i") ? p.flags : `${p.flags}i`)),
  }));
}

const COMPILED = compile();

export function detectArtifact(query) {
  const q = normalize(query);
  return ARTIFACTS.filter((a) => a.test.test(q)).map((a) => a.id);
}

export function matchConcepts(text) {
  const q = normalize(text);
  const hit = [];
  for (const c of COMPILED) {
    if (c.rx.some((r) => r.test(q))) hit.push(c);
  }
  return hit;
}

const LEFTOVER_OK = /graph|code|rag|vault|embed|vector|digest|mcp|plugin|agent|browser|token|memory|claude|cursor|obsidian|langgraph|playwright|graphrag/;

export function leftoverTerms(query, matched) {
  let rest = normalize(query);
  for (const c of matched) {
    for (const r of c.rx) rest = rest.replace(r, " ");
  }
  return tokenize(rest).filter(
    (t) =>
      !FILLERS.has(t) &&
      t.length >= 5 &&
      LEFTOVER_OK.test(t) &&
      !/^(предлага|читает|пишет|builds|pulls|spends|needs)/.test(t)
  );
}

export function extractConcepts(query, forced) {
  if (Array.isArray(forced) && forced.length) {
    return {
      query: String(query || "").trim(),
      artifacts: detectArtifact(query),
      concepts: forced,
      leftover: [],
    };
  }
  const raw = String(query || "").trim();
  const matched = matchConcepts(raw);
  const leftover = leftoverTerms(raw, matched);
  const extra = leftover.map((t) => ({
    id: `adhoc-${t}`,
    label: t,
    weight: 1,
    terms: [t],
    rx: [new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")],
    adhoc: true,
  }));
  const concepts = dedupeConcepts([...matched, ...extra]);
  return {
    query: raw,
    artifacts: detectArtifact(raw),
    concepts,
    leftover,
  };
}

export function dedupeConcepts(list) {
  const seen = new Set();
  const out = [];
  for (const c of list) {
    if (!c?.id || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

export function conceptTerms(concepts) {
  const terms = [];
  for (const c of concepts || []) {
    for (const t of c.terms || []) terms.push(t);
  }
  return [...new Set(terms)];
}

export function blobHitsConcept(blob, concept) {
  const n = normalize(blob);
  if ((concept.rx || []).some((r) => r.test(n))) return true;
  return (concept.terms || []).some((t) => n.includes(normalize(t)));
}

export function matchConceptHits(blob, concepts) {
  return (concepts || []).filter((c) => blobHitsConcept(blob, c));
}

export function whyFitsLine(matched, llmWhy) {
  if (llmWhy) return String(llmWhy).slice(0, 280);
  if (!matched.length) {
    return "Почему подходит под твой запрос: слабое пересечение понятий — ближайший вариант.";
  }
  return `Почему подходит под твой запрос: ${matched.map((c) => c.label).join(", ")}.`;
}

export function queriesFromConcepts(extracted, { pushed, budget = 4, stars = 3 } = {}) {
  const concepts = [...(extracted.concepts || [])].sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const must = concepts.filter((c) => (c.weight || 0) >= 3).slice(0, 4);
  const pool = must.length ? must : concepts.slice(0, 4);
  const term = (c, i = 0) => (c.terms && c.terms[i]) || c.label;
  const filters = (q) =>
    `${q} fork:false archived:false stars:>${stars} pushed:>${pushed}`;

  const queries = [];
  const add = (q) => {
    const s = String(q || "").replace(/\s+/g, " ").trim();
    if (s && !queries.includes(filters(s)) && !queries.includes(s)) queries.push(filters(s));
  };

  const orGroup = (parts) =>
    parts
      .filter(Boolean)
      .map((p) => (/\s/.test(p) ? `"${p}"` : p))
      .join(" OR ");

  if (pool.length) {
    add(pool.slice(0, 3).map((c) => term(c, 0)).join(" "));
  }
  if (pool[0]?.terms?.length > 1) {
    add(orGroup(pool[0].terms.slice(0, 4)));
  }

  const graphish = concepts.find((c) => c.id === "knowledge-graph" || c.id === "codebase-graph");
  const tokens = concepts.find((c) => c.id === "token-efficiency");
  if (graphish) add(orGroup(["graphrag", "knowledge graph", "graph memory", "graphiti"]));
  if (graphish && tokens) add(orGroup(["graphrag", "context compression", "token efficient"]));
  if (concepts.some((c) => c.id === "sequential-planning" || c.id === "self-building")) {
    add(orGroup(["langgraph", "agent planner", "state graph"]));
  }
  if (graphish) add(orGroup(["codebase graph", "repo map", "code knowledge graph"]));

  if (concepts.some((c) => c.id === "obsidian")) {
    add("obsidian related notes plugin ai");
  }
  if (concepts.some((c) => c.id === "memory") && concepts.some((c) => c.id === "obsidian")) {
    add("obsidian memory mcp vault");
  }
  if (concepts.some((c) => c.id === "telegram")) {
    add("telegram mcp digest summarize");
  }
  if (concepts.some((c) => c.id === "browser-agent") || concepts.some((c) => c.id === "form-fill")) {
    add("browser agent fill forms playwright");
  }
  if (concepts.some((c) => c.id === "codebase-graph") || concepts.some((c) => c.id === "context-for-agent")) {
    add("repo map codebase graph tokens");
  }

  const wantMcp =
    extracted.artifacts?.includes("mcp") ||
    concepts.some((c) => c.id === "mcp" || c.id === "memory" || c.id === "knowledge-graph");
  if (wantMcp && pool[0]) {
    add(`topic:mcp-server ${term(pool[0])}`);
  }
  if (extracted.artifacts?.includes("plugin") && pool[0]) {
    add(`${term(pool[0])} plugin`);
  }

  const unique = [];
  for (const q of queries) {
    if (!unique.includes(q)) unique.push(q);
  }
  return unique.slice(0, Math.max(3, Math.min(5, budget)));
}

export function customConcept(text) {
  const label = String(text || "").trim();
  if (!label) return null;
  const id = `custom-${normalize(label).replace(/\s+/g, "-").slice(0, 40)}`;
  const terms = label.split(/\s+/).filter((t) => t.length >= 2);
  return {
    id,
    label,
    weight: 3,
    terms: terms.length ? terms : [label],
    rx: [new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")],
    custom: true,
  };
}
