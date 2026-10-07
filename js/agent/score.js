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

export function scoreRepo(repo, plan, slugs) {
  const blob = normalize(
    `${repo.full_name} ${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")}`
  );
  let rel = 0;
  const tokens = [...new Set([...(plan.expanded || []), ...(plan.keywords || [])])];
  for (const tok of tokens) {
    if (tok.length < 2) continue;
    if (blob.includes(tok)) rel += tok.length >= 4 ? 8 : 5;
  }
  for (const intent of plan.intents || []) {
    for (const topic of intent.topics || []) {
      if ((repo.topics || []).includes(topic)) rel += 12;
      const head = topic.split("-")[0];
      if (head && blob.includes(head)) rel += 4;
    }
    if (intent.category && blob.includes(intent.category)) rel += 3;
  }

  const starScore = Math.min(36, Math.log10((repo.stargazers_count || 0) + 1) * 10);
  const ageDays = (Date.now() - new Date(repo.pushed_at || Date.now())) / 86400000;
  const fresh = Math.max(0, 16 - ageDays / 35);
  const slug = (repo.full_name || "").toLowerCase();
  const catalogBonus = slugs.has(slug) ? 22 : 0;
  const specific = tokens.filter((t) => t.length >= 3 && !GENERIC.has(t));
  const specificHits = specific.filter((t) => blob.includes(t)).length;
  const intentHit = (plan.intents || []).some((intent) => {
    if (intent.id && blob.includes(intent.id)) return true;
    return (intent.topics || []).some((topic) => (repo.topics || []).includes(topic));
  });
  return {
    total: rel + starScore + fresh + catalogBonus,
    rel,
    starScore,
    fresh,
    catalogBonus,
    specificHits,
    intentHit,
  };
}
