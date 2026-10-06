const CATALOG_URL = "data/catalog.json";
const MIN_GOOD_SCORE = 24;
const STOPWORDS = new Set([
  "для",
  "без",
  "при",
  "это",
  "как",
  "что",
  "или",
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "your",
  "that",
  "this",
]);

const SYNONYMS = {
  плагин: ["plugin", "plugins", "addon"],
  plugin: ["плагин", "plugins", "addon"],
  ии: ["ai", "llm", "gpt"],
  ai: ["ии", "llm", "gpt"],
  телеграм: ["telegram"],
  телеграмм: ["telegram"],
  telegram: ["телеграм", "телеграмм"],
  правила: ["rules", "cursorrules"],
  rules: ["правила", "cursorrules"],
  браузер: ["browser", "chrome"],
  browser: ["браузер", "chrome"],
  заметки: ["notes", "obsidian", "vault"],
  агент: ["agent", "mcp"],
  автоматизация: ["automation", "n8n", "workflow"],
  cursor: ["cursorrules", "ide"],
};

const CATEGORY_RU = {
  cursor: "Cursor",
  obsidian: "Obsidian",
  mcp: "MCP",
  browser: "Браузер",
  catalog: "Каталог",
  skill: "Skill",
};

const els = {
  prompt: document.getElementById("prompt"),
  form: document.getElementById("search-form"),
  results: document.getElementById("results"),
  status: document.getElementById("status"),
  empty: document.getElementById("empty"),
  error: document.getElementById("error"),
  examples: document.getElementById("examples"),
};

let catalog = [];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

function tokenize(text) {
  return normalize(text)
    .split(/[^\p{L}\p{N}+#.-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function expandTokens(tokens) {
  const out = new Set(tokens);
  for (const tok of tokens) {
    const extra = SYNONYMS[tok];
    if (extra) extra.forEach((s) => out.add(s));
  }
  return [...out];
}

function scoreItem(item, tokens) {
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

function formatStars(n) {
  if (typeof n !== "number") return "";
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k★`;
  }
  return `${n}★`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCards(items) {
  return items
    .map((item) => {
      const tags = (item.tags || [])
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join("");
      const stars = formatStars(item.stars);
      return `<article class="card">
        <div class="card-top">
          <h2>${escapeHtml(item.name)}</h2>
          <div class="meta">
            <span class="cat">${escapeHtml(CATEGORY_RU[item.category] || item.category)}</span>
            ${stars ? `<span class="stars" title="GitHub stars">${stars}</span>` : ""}
          </div>
        </div>
        <p class="insight">${escapeHtml(item.insight_ru)}</p>
        <p class="insight-en">${escapeHtml(item.insight_en)}</p>
        <div class="tags">${tags}</div>
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>
      </article>`;
    })
    .join("");
}

function search(query) {
  const raw = query.trim();
  els.error.hidden = true;

  if (!raw) {
    els.results.innerHTML = "";
    els.status.innerHTML = "";
    els.empty.hidden = false;
    return;
  }

  const tokens = expandTokens(tokenize(raw));
  const ranked = catalog
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.score || 0;
  const good = ranked.filter((r) => r.score >= MIN_GOOD_SCORE && r.score > 0);
  const weak = ranked.filter((r) => r.score > 0).slice(0, 5);
  const fallback = !good.length;

  const shown = (fallback ? weak : good).slice(0, 8).map((r) => r.item);
  els.empty.hidden = true;

  if (!shown.length || best <= 0) {
    els.status.innerHTML = `<strong>Ничего не нашлось</strong> · Nothing matched`;
    els.results.innerHTML = `<p class="fallback-tip">Попробуйте короче и конкретнее: инструмент, среда или задача — например «MCP», «Obsidian», «Cursor rules».</p>`;
    return;
  }

  if (fallback) {
    els.status.innerHTML = `<strong>Ближайшие варианты</strong> · closest matches`;
    els.results.innerHTML =
      `<p class="fallback-tip">Точных совпадений мало. Расширьте запрос: добавьте среду (Cursor / Obsidian / MCP) или тип (плагин, skill, браузер).</p>` +
      renderCards(shown);
    return;
  }

  els.status.innerHTML = `<strong>Найдено ${shown.length}</strong> · ranked by keyword overlap`;
  els.results.innerHTML = renderCards(shown);
}

async function loadCatalog() {
  const res = await fetch(CATALOG_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  catalog = Array.isArray(data) ? data : data.items || [];
  if (!catalog.length) throw new Error("empty catalog");
}

function wireUi() {
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    search(els.prompt.value);
  });

  els.prompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      search(els.prompt.value);
    }
  });

  els.examples.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-q]");
    if (!btn) return;
    els.prompt.value = btn.getAttribute("data-q");
    els.prompt.focus();
    search(els.prompt.value);
  });
}

wireUi();

loadCatalog().catch(() => {
  els.empty.hidden = true;
  els.error.hidden = false;
});
