import { matchConceptHits } from "./concepts.js";
import { normalize, repoSlug } from "./text.js";

const GENERIC = new Set([
  "ai",
  "ии",
  "llm",
  "gpt",
  "plugin",
  "plugins",
  "addon",
  "agent",
  "automation",
  "workflow",
  "server",
  "tools",
  "tool",
  "search",
  "app",
]);

export function catalogIndex(catalog) {
  const slugs = new Set();
  const bySlug = new Map();
  for (const item of catalog || []) {
    const slug = repoSlug(item.url);
    if (slug) {
      slugs.add(slug);
      bySlug.set(slug, item);
    }
  }
  return { slugs, bySlug };
}

export function itemBlob(item) {
  return `${item.name || ""} ${item.id || ""} ${item.description || ""} ${item.insight_ru || ""} ${item.insight_en || ""} ${(item.tags || []).join(" ")} ${(item.keywords || []).join(" ")}`;
}

export function repoBlob(repo, readme = "") {
  return `${repo.full_name} ${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")} ${String(readme || "").slice(0, 4000)}`;
}

export function scoreRepo(repo, plan, slugs, readme = "") {
  const blob = normalize(repoBlob(repo, readme));
  const concepts = plan.concepts || [];
  const matched = matchConceptHits(blob, concepts);
  let conceptPts = 0;
  for (const c of matched) {
    conceptPts += (c.weight || 1) * 14;
  }
  const must = plan.mustHave || [];
  const mustHits = must.filter((id) => matched.some((c) => c.id === id)).length;
  if (must.length) conceptPts += mustHits * 10;

  let rel = 0;
  const tokens = [...new Set([...(plan.expanded || []), ...(plan.keywords || [])])];
  for (const tok of tokens) {
    if (tok.length < 2) continue;
    if (blob.includes(normalize(tok))) rel += tok.length >= 4 ? 5 : 3;
  }
  for (const intent of plan.intents || []) {
    for (const topic of intent.topics || []) {
      if ((repo.topics || []).includes(topic)) rel += 10;
    }
  }

  const stars = repo.stargazers_count || 0;
  const starScore = Math.min(40, Math.log10(stars + 1) * 11);
  const obscure = stars < 25 && !slugs.has((repo.full_name || "").toLowerCase()) ? 0.72 : 1;
  const ageDays = (Date.now() - new Date(repo.pushed_at || Date.now())) / 86400000;
  const fresh = Math.max(0, 12 - ageDays / 45);
  const slug = (repo.full_name || "").toLowerCase();
  const catalogBonus = slugs.has(slug) ? 18 : 0;
  const specific = tokens.filter((t) => t.length >= 3 && !GENERIC.has(t));
  const specificHits = specific.filter((t) => blob.includes(normalize(t))).length;
  const coverage = concepts.length ? matched.length / concepts.length : 0;

  return {
    total: (conceptPts + rel * 0.25 + starScore + fresh + catalogBonus + coverage * 18) * obscure,
    rel,
    conceptPts,
    starScore,
    fresh,
    catalogBonus,
    specificHits,
    coverage,
    matched,
    intentHit: (plan.intents || []).some((intent) => {
      if (intent.id && blob.includes(intent.id)) return true;
      return (intent.topics || []).some((topic) => (repo.topics || []).includes(topic));
    }),
  };
}
