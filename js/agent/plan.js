import {
  CONCEPTS,
  conceptTerms,
  dedupeConcepts,
  extractConcepts,
  queriesFromConcepts,
} from "./concepts.js";
import { detectIntents } from "./intents.js";
import { expandTokens, pushedSince, toEnglish, tokenize } from "./text.js";

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

export function buildPlan(query, options = {}) {
  const raw = String(query || "").trim();
  const extracted = extractConcepts(raw, options.forcedConcepts);
  const tokens = tokenize(raw);
  const expanded = expandTokens(tokens);
  const english = toEnglish(raw) || raw;
  const intents = detectIntents(raw, expanded);
  const pushed = pushedSince(18);
  const budget = options.queryBudget || (options.githubToken ? 5 : 4);
  const stars = extracted.concepts.some((c) => (c.weight || 0) >= 3) ? 3 : 5;

  const queries = queriesFromConcepts(extracted, { pushed, budget, stars });

  const keywords = uniq([
    ...conceptTerms(extracted.concepts),
    ...expanded.filter((t) => !/^[\u0400-\u04ff]/.test(t)),
    ...intents.flatMap((i) => i.extra || []),
  ]).filter((t) => t.length >= 2);

  return {
    query: raw,
    english,
    tokens,
    expanded,
    keywords,
    concepts: extracted.concepts,
    artifacts: extracted.artifacts,
    leftover: extracted.leftover,
    intents: intents.map((i) => ({
      id: i.id,
      category: i.category,
      topics: i.topics,
    })),
    stars,
    pushed,
    queries,
    mustHave: (options.mustHave || extracted.concepts.filter((c) => (c.weight || 0) >= 3).map((c) => c.id)).slice(0, 6),
    niceToHave: extracted.concepts.filter((c) => (c.weight || 0) < 3).map((c) => c.id),
  };
}

export function applyLlmPlan(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const english = String(patch.english || base.english).slice(0, 200);
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
    .slice(0, 5);
  if (!queries.length) queries = base.queries;

  let concepts = base.concepts;
  if (Array.isArray(patch.concepts) && patch.concepts.length) {
    const extra = patch.concepts
      .map((c) => {
        if (typeof c === "string") {
          const known = CONCEPTS.find((k) => k.id === c || k.label === c);
          return known || { id: c, label: c, weight: 3, terms: [c], rx: [] };
        }
        const id = String(c.id || c.label || "").slice(0, 40);
        if (!id) return null;
        return {
          id,
          label: String(c.label || id),
          weight: Number(c.weight || 3),
          terms: Array.isArray(c.terms) ? c.terms.map(String).slice(0, 8) : [id],
          rx: [],
        };
      })
      .filter(Boolean);
    concepts = dedupeConcepts([...extra, ...base.concepts]);
  }

  const keywords = Array.isArray(patch.keywords)
    ? patch.keywords.map((k) => String(k).toLowerCase()).slice(0, 20)
    : uniq([...conceptTerms(concepts), ...(base.keywords || [])]);

  return {
    ...base,
    english,
    queries,
    keywords,
    concepts,
    mustHave: Array.isArray(patch.mustHave)
      ? patch.mustHave.map(String).slice(0, 8)
      : base.mustHave,
    niceToHave: Array.isArray(patch.niceToHave)
      ? patch.niceToHave.map(String).slice(0, 8)
      : base.niceToHave,
  };
}
