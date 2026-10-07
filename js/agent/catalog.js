import { expandTokens, normalize, tokenize } from "./text.js";

export const MIN_GOOD_SCORE = 24;

export const CATEGORY_RU = {
  cursor: "Cursor",
  obsidian: "Obsidian",
  mcp: "MCP",
  browser: "Браузер",
  catalog: "Каталог",
  skill: "Skill",
};

export function scoreCatalogItem(item, tokens) {
  const name = normalize(item.name);
  const id = normalize(item.id);
  const category = normalize(item.category);
  const tags = (item.tags || []).map(normalize);
  const keywords = (item.keywords || []).map(normalize);
  const insight = normalize(`${item.insight_ru} ${item.insight_en}`);
  let score = 0;
  let hits = 0;

  for (const tok of tokens) {
    let local = 0;
    if (name === tok) local += 14;
    else if (tok.length >= 3 && name.includes(tok)) local += 10;
    if (id === tok) local += 8;
    else if (tok.length >= 3 && id.includes(tok)) local += 8;
    if (category === tok) local += 6;
    if (tags.some((t) => t === tok || (tok.length >= 3 && t.includes(tok)))) {
      local += 7;
    }
    if (keywords.some((k) => k === tok)) local += 8;
    else if (
      tok.length >= 3 &&
      keywords.some((k) => k.includes(tok) || tok.includes(k))
    ) {
      local += 4;
    }
    if (tok.length >= 3 && insight.includes(tok)) local += 2;
    if (local > 0) {
      score += local;
      hits += 1;
    }
  }

  if (hits >= 2) score += hits * 2;
  return score;
}

export function searchCatalog(catalog, query, limit = 8) {
  const tokens = expandTokens(tokenize(query));
  const ranked = (catalog || [])
    .map((item) => ({ item, score: scoreCatalogItem(item, tokens) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.score || 0;
  const good = ranked.filter((r) => r.score >= MIN_GOOD_SCORE && r.score > 0);
  const weak = ranked.filter((r) => r.score > 0).slice(0, 5);
  const fallback = !good.length;
  const shown = (fallback ? weak : good).slice(0, limit);

  return {
    tokens,
    best,
    fallback: fallback && best > 0,
    empty: best <= 0,
    rows: shown,
  };
}
