export const STOPWORDS = new Set([
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

export const SYNONYMS = {
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
  хром: ["chrome", "browser"],
  chrome: ["хром", "браузер", "extension"],
  расширение: ["extension", "chrome-extension"],
  extension: ["расширение", "chrome-extension"],
  заметки: ["notes", "obsidian", "vault"],
  агент: ["agent", "mcp"],
  автоматизация: ["automation", "n8n", "workflow"],
  cursor: ["cursorrules", "ide"],
  notion: ["ноушен"],
  ноушен: ["notion"],
};

const DICT = {
  плагин: "plugin",
  плагина: "plugin",
  плагины: "plugin",
  расширение: "extension",
  расширения: "extension",
  хром: "chrome",
  хрома: "chrome",
  агент: "agent",
  агента: "agent",
  агентом: "agent",
  ии: "ai",
  правил: "rules",
  правила: "rules",
  телеграм: "telegram",
  телеграмма: "telegram",
  телеграмм: "telegram",
  автоматизация: "automation",
  автоматизации: "automation",
  заметки: "notes",
  заметок: "notes",
  поиск: "search",
  браузер: "browser",
  навык: "skill",
  правила: "rules",
};

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

export function tokenize(text) {
  return normalize(text)
    .split(/[^\p{L}\p{N}+#.-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export function expandTokens(tokens) {
  const out = new Set(tokens);
  for (const tok of tokens) {
    const extra = SYNONYMS[tok];
    if (extra) extra.forEach((s) => out.add(s));
  }
  return [...out];
}

export function toEnglish(query) {
  return tokenize(query)
    .map((t) => DICT[t] || t)
    .filter(Boolean)
    .join(" ");
}

export function repoSlug(url) {
  const m = String(url || "").match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return "";
  return `${m[1]}/${m[2]}`.replace(/\.git$/, "").toLowerCase();
}

export function formatStars(n) {
  if (typeof n !== "number") return "";
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k★`;
  }
  return `${n}★`;
}

export function pushedSince(months = 18) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}
