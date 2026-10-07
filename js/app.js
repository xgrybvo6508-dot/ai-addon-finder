import { CATEGORY_RU } from "./agent/catalog.js";
import { runAgent } from "./agent/pipeline.js";
import {
  DEFAULT_MODELS,
  OPENROUTER_BASE,
  clearSecrets,
  loadSettings,
  saveSettings,
} from "./agent/settings.js";
import { formatStars } from "./agent/text.js";

const CATALOG_URL = "data/catalog.json";
const STEP_ORDER = ["understand", "search", "analyze", "done"];
const STEP_LABEL = {
  understand: "Понимаю запрос",
  search: "Ищу на GitHub",
  analyze: "Анализирую",
  done: "Готово",
};

const els = {
  prompt: document.getElementById("prompt"),
  form: document.getElementById("search-form"),
  btn: document.getElementById("search-btn"),
  results: document.getElementById("results"),
  status: document.getElementById("status"),
  empty: document.getElementById("empty"),
  error: document.getElementById("error"),
  examples: document.getElementById("examples"),
  steps: document.getElementById("steps"),
  settings: document.getElementById("settings"),
  settingsToggle: document.getElementById("settings-toggle"),
  ghToken: document.getElementById("gh-token"),
  llmKey: document.getElementById("llm-key"),
  llmBase: document.getElementById("llm-base"),
  llmModel: document.getElementById("llm-model"),
  provider: document.getElementById("llm-provider"),
  clearKeys: document.getElementById("clear-keys"),
};

let catalog = [];
let abort = null;
let countdownTimer = null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSteps(active, doneSet, extra = {}) {
  els.steps.hidden = false;
  els.steps.innerHTML = STEP_ORDER.map((id) => {
    const state = doneSet.has(id) ? "done" : id === active ? "active" : "";
    let label = STEP_LABEL[id];
    if (id === "search" && extra.cached) label += " · кэш";
    return `<li class="${state}" data-step="${id}">${label}</li>`;
  }).join("");
}

function sourceLabel(source) {
  if (source === "catalog") return "каталог";
  if (source === "both") return "каталог + GitHub";
  return "GitHub";
}

function renderCards(items) {
  return items
    .map((item) => {
      const tags = (item.tags || [])
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join("");
      const stars = formatStars(item.stars);
      const install = item.install_ru
        ? `<p class="install">${escapeHtml(item.install_ru)}</p>`
        : "";
      return `<article class="card">
        <div class="card-top">
          <h2>${escapeHtml(item.name)}</h2>
          <div class="meta">
            <span class="cat">${escapeHtml(CATEGORY_RU[item.category] || item.category || "GitHub")}</span>
            <span class="source">${escapeHtml(sourceLabel(item.source))}</span>
            ${stars ? `<span class="stars" title="GitHub stars">${stars}</span>` : ""}
          </div>
        </div>
        <p class="insight">${escapeHtml(item.insight_ru)}</p>
        ${item.insight_en ? `<p class="insight-en">${escapeHtml(item.insight_en)}</p>` : ""}
        ${install}
        <div class="tags">${tags}</div>
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>
      </article>`;
    })
    .join("");
}

function settingsFromForm() {
  return {
    githubToken: els.ghToken.value.trim(),
    llmKey: els.llmKey.value.trim(),
    llmBase: els.llmBase.value.trim() || OPENROUTER_BASE,
    llmModel: els.llmModel.value,
    provider: els.provider.value,
  };
}

function fillSettings() {
  const s = loadSettings();
  els.ghToken.value = s.githubToken;
  els.llmKey.value = s.llmKey;
  els.llmBase.value = s.llmBase;
  els.provider.value = s.provider;
  els.llmModel.innerHTML = DEFAULT_MODELS.map(
    (m) => `<option value="${m.id}">${m.label}</option>`
  ).join("");
  if (![...els.llmModel.options].some((o) => o.value === s.llmModel)) {
    const opt = document.createElement("option");
    opt.value = s.llmModel;
    opt.textContent = s.llmModel;
    els.llmModel.appendChild(opt);
  }
  els.llmModel.value = s.llmModel;
}

function startCountdown(iso) {
  clearInterval(countdownTimer);
  const reset = new Date(iso).getTime();
  const tick = () => {
    const sec = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    const node = document.getElementById("rate-left");
    if (node) node.textContent = String(sec);
    if (sec <= 0) clearInterval(countdownTimer);
  };
  countdownTimer = setInterval(tick, 1000);
  tick();
}

function rateBanner(result) {
  if (!result.rateLimit) return "";
  return `<p class="fallback-tip">Лимит GitHub Search (без токена ~10 запросов/мин). Показан каталог, повтор через <strong id="rate-left">…</strong> с. Токен в Настройках поднимает лимит.</p>`;
}

async function search(query) {
  const raw = query.trim();
  els.error.hidden = true;
  clearInterval(countdownTimer);

  if (!raw) {
    els.results.innerHTML = "";
    els.status.innerHTML = "";
    els.steps.hidden = true;
    els.empty.hidden = false;
    return;
  }

  if (abort) abort.abort();
  abort = new AbortController();
  els.empty.hidden = true;
  els.btn.disabled = true;
  const done = new Set();
  renderSteps("understand", done);
  els.status.innerHTML = "<strong>Агент работает…</strong>";
  els.results.innerHTML = "";

  const s = settingsFromForm();
  try {
    const result = await runAgent(raw, {
      catalog,
      signal: abort.signal,
      githubToken: s.githubToken,
      llm: s.llmKey ? { key: s.llmKey, base: s.llmBase, model: s.llmModel } : null,
      onStep(id, state, extra) {
        if (state === "done") done.add(id);
        renderSteps(state === "run" ? id : "", done, extra || {});
      },
    });

    renderSteps("done", new Set(STEP_ORDER), { cached: result.cached });

    if (result.empty) {
      els.status.innerHTML = `<strong>Ничего не нашлось</strong> · Nothing matched`;
      els.results.innerHTML = `${rateBanner(result)}<p class="fallback-tip">Попробуйте короче: среда (Obsidian, MCP, Chrome) и тип (плагин, skill, агент).</p>`;
      if (result.rateLimit) startCountdown(result.rateLimit.resetAt);
      return;
    }

    const live = result.cards.filter((c) => c.source !== "catalog").length;
    const via = result.cached
      ? "кэш 24ч"
      : result.fallback
        ? "каталог (лимит GitHub)"
        : live
          ? "GitHub + каталог"
          : "каталог";
    els.status.innerHTML = `<strong>Найдено ${result.cards.length}</strong> · ${via}${s.llmKey ? " · LLM insights" : ""}`;
    els.results.innerHTML = rateBanner(result) + renderCards(result.cards);
    if (result.rateLimit) startCountdown(result.rateLimit.resetAt);
  } catch (err) {
    if (err.name === "AbortError") return;
    els.status.innerHTML = `<strong>Сбой агента</strong> — показываю каталог`;
    try {
      const result = await runAgent(raw, {
        catalog,
        githubToken: "",
        persist: false,
        skipCache: true,
        fetchFn: async () => {
          throw new Error("offline");
        },
      });
      els.results.innerHTML =
        `<p class="fallback-tip">Сеть/GitHub недоступны. Результаты только из локального каталога.</p>` +
        renderCards(result.cards);
    } catch {
      els.results.innerHTML = `<p class="fallback-tip">Не удалось выполнить поиск. Проверьте сеть и повторите.</p>`;
    }
  } finally {
    els.btn.disabled = false;
  }
}

async function loadCatalog() {
  const res = await fetch(CATALOG_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  catalog = Array.isArray(data) ? data : data.items || [];
  if (!catalog.length) throw new Error("empty catalog");
}

function wireUi() {
  fillSettings();
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
  els.settingsToggle.addEventListener("click", () => {
    const open = els.settings.hidden;
    els.settings.hidden = !open;
    els.settingsToggle.setAttribute("aria-expanded", String(open));
  });
  els.settings.addEventListener("submit", (e) => {
    e.preventDefault();
    saveSettings(settingsFromForm());
    els.status.innerHTML = "<strong>Настройки сохранены</strong> · только в этом браузере";
  });
  els.provider.addEventListener("change", () => {
    if (els.provider.value === "openrouter" && !els.llmBase.value) {
      els.llmBase.value = OPENROUTER_BASE;
    }
  });
  els.clearKeys.addEventListener("click", () => {
    clearSecrets();
    fillSettings();
  });
}

wireUi();
loadCatalog().catch(() => {
  els.empty.hidden = true;
  els.error.hidden = false;
});
