import { searchCatalog } from "./catalog.js";
import { localStorageStore, memoryStore, readCache, writeCache } from "./cache.js";
import { matchConceptHits, whyFitsLine } from "./concepts.js";
import { fetchReadme, isUsableRepo, RateLimitError, searchRepositories } from "./github.js";
import { buildInsights } from "./insights.js";
import { polishInsightsWithLlm, rewritePlanWithLlm } from "./llm.js";
import { applyLlmPlan, buildPlan } from "./plan.js";
import { catalogIndex, itemBlob, scoreRepo } from "./score.js";
import { repoSlug } from "./text.js";

function conceptCacheExtra(concepts) {
  if (!concepts?.length) return "";
  return concepts.map((c) => c.id).sort().join(",");
}

function catalogCards(catalog, query, concepts) {
  const found = searchCatalog(catalog, query, 8, concepts);
  return found.rows.map(({ item, score, matched }) => {
    const hits = matched || matchConceptHits(itemBlob(item), concepts);
    return {
      id: item.id,
      name: item.name,
      url: item.url,
      slug: repoSlug(item.url),
      category: item.category,
      tags: item.tags || [],
      stars: item.stars,
      insight_ru: item.insight_ru,
      insight_en: item.insight_en,
      install_ru: "Как поставить: откройте репозиторий — шаги в README.",
      why_ru: whyFitsLine(hits),
      matchedConcepts: hits.map((c) => ({ id: c.id, label: c.label })),
      source: "catalog",
      score,
      description: item.insight_en,
      pushed_at: null,
    };
  });
}

function toCard(repo, plan, score, catalogItem) {
  const insights = catalogItem
    ? {
        kind: catalogItem.category,
        insight_ru: catalogItem.insight_ru,
        insight_en: catalogItem.insight_en,
        install_ru: "Как поставить: см. README; карточка из каталога + GitHub.",
      }
    : buildInsights(repo, plan);
  const hits = score.matched || [];
  return {
    id: repo.full_name,
    name: repo.name,
    url: repo.html_url,
    slug: repo.full_name.toLowerCase(),
    category: insights.kind,
    tags: (repo.topics || []).slice(0, 6),
    stars: repo.stargazers_count || 0,
    insight_ru: insights.insight_ru,
    insight_en: insights.insight_en,
    install_ru: insights.install_ru,
    why_ru: whyFitsLine(hits),
    matchedConcepts: hits.map((c) => ({ id: c.id, label: c.label })),
    source: catalogItem ? "both" : "github",
    score: score.total,
    description: repo.description || "",
    pushed_at: repo.pushed_at,
    readme: "",
  };
}

async function liveSearch(plan, options) {
  const fetchFn = options.fetchFn || fetch;
  const seen = new Map();
  let rateLimit = null;
  const budget = plan.queries.slice(0, options.queryBudget || plan.queries.length);
  for (const q of budget) {
    try {
      const items = await searchRepositories(q, {
        token: options.githubToken,
        fetchFn,
        signal: options.signal,
        perPage: 8,
      });
      for (const repo of items) {
        const key = (repo.full_name || "").toLowerCase();
        if (!key || seen.has(key)) continue;
        if (!isUsableRepo(repo, Math.max(2, Math.min(plan.stars, 6)))) continue;
        seen.set(key, repo);
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        rateLimit = err;
        break;
      }
      if (err.name === "AbortError") throw err;
    }
  }
  return { repos: [...seen.values()], rateLimit };
}

export async function runAgent(query, options = {}) {
  const onStep = options.onStep || (() => {});
  const catalog = options.catalog || [];
  const store = options.store || (options.persist === false ? memoryStore() : localStorageStore());
  const fetchFn = options.fetchFn || fetch;
  const raw = String(query || "").trim();
  const cacheExtra = conceptCacheExtra(options.forcedConcepts);

  const cached = options.skipCache ? null : readCache(store, raw, cacheExtra);
  if (cached) {
    onStep("understand", "done", { cached: true, plan: cached.plan });
    onStep("search", "done", { cached: true });
    onStep("analyze", "done", { cached: true });
    onStep("done", "done", { cached: true });
    return { ...cached, cached: true };
  }

  onStep("understand", "run");
  const queryBudget = options.githubToken ? 5 : 4;
  let plan = buildPlan(raw, {
    forcedConcepts: options.forcedConcepts,
    githubToken: options.githubToken,
    queryBudget,
  });
  const llm = options.llm?.key
    ? {
        key: options.llm.key,
        base: options.llm.base,
        model: options.llm.model,
      }
    : null;
  if (llm && !options.forcedConcepts) {
    const patch = await rewritePlanWithLlm(raw, plan, llm, fetchFn, options.signal);
    plan = applyLlmPlan(plan, patch);
    plan.queries = plan.queries.slice(0, queryBudget);
  }
  onStep("understand", "done", { plan });

  onStep("search", "run");
  const { repos, rateLimit } = await liveSearch(plan, {
    githubToken: options.githubToken,
    fetchFn,
    signal: options.signal,
    queryBudget,
  });
  onStep("search", "done", {
    count: repos.length,
    rateLimit: rateLimit ? rateLimit.resetAt.toISOString() : null,
  });

  onStep("analyze", "run");
  const { slugs, bySlug } = catalogIndex(catalog);
  let scored = repos
    .map((repo) => ({ repo, score: scoreRepo(repo, plan, slugs, ""), readme: "" }))
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 12);

  await Promise.all(
    scored.slice(0, 8).map(async (row) => {
      row.readme = await fetchReadme(row.repo, {
        fetchFn,
        signal: options.signal,
      });
      row.score = scoreRepo(row.repo, plan, slugs, row.readme);
    })
  );

  scored = scored
    .filter((row) => {
      if (row.score.catalogBonus > 0) return true;
      if ((row.score.matched || []).length >= 1) return true;
      if (row.score.rel >= 12 && row.score.specificHits > 0) return true;
      return false;
    })
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 10);

  const liveCards = scored.map((row) => {
    const card = toCard(
      row.repo,
      plan,
      row.score,
      bySlug.get(row.repo.full_name.toLowerCase())
    );
    if (row.readme && card.source === "github") {
      const extra = buildInsights(row.repo, plan, row.readme);
      card.insight_ru = extra.insight_ru;
      card.install_ru = extra.install_ru;
      card.readme = row.readme.slice(0, 2000);
    }
    return card;
  });

  const local = catalogCards(catalog, raw, plan.concepts);
  const merged = [];
  const have = new Set();
  for (const card of [...liveCards, ...local]) {
    const key = card.slug || card.url;
    if (!key || have.has(key)) {
      if (have.has(key)) {
        const prev = merged.find((c) => (c.slug || c.url) === key);
        if (prev && card.source === "catalog") {
          prev.source = prev.source === "github" ? "both" : prev.source;
          if (!prev.insight_ru && card.insight_ru) prev.insight_ru = card.insight_ru;
        }
      }
      continue;
    }
    have.add(key);
    merged.push(card);
  }

  merged.sort((a, b) => (b.score || 0) - (a.score || 0));
  let cards = merged.slice(0, 10);

  if (llm && cards.length) {
    cards = await polishInsightsWithLlm(raw, cards, llm, fetchFn, options.signal);
    cards = cards.filter((c) => /^https:\/\/github\.com\//i.test(c.url));
    cards = cards.map((c) => ({
      ...c,
      why_ru: c.why_ru || whyFitsLine(c.matchedConcepts || []),
    }));
  }

  onStep("analyze", "done", { count: cards.length });
  onStep("done", "done");

  const result = {
    plan,
    cards,
    rateLimit: rateLimit ? { resetAt: rateLimit.resetAt.toISOString() } : null,
    fallback: Boolean(rateLimit) && !liveCards.length,
    empty: !cards.length,
    cached: false,
  };
  if (!rateLimit) {
    const slim = {
      ...result,
      cards: result.cards.map((c) => ({ ...c, readme: "" })),
    };
    writeCache(store, raw, slim, cacheExtra);
  }
  return result;
}

export { RateLimitError };
