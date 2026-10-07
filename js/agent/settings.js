const KEYS = {
  gh: "aaf:githubToken",
  llmKey: "aaf:llmKey",
  llmBase: "aaf:llmBase",
  llmModel: "aaf:llmModel",
  provider: "aaf:llmProvider",
};

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export const DEFAULT_MODELS = [
  { id: "perplexity/sonar", label: "Perplexity Sonar" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini — быстрый" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
];

function ls() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function loadSettings() {
  const store = ls();
  const get = (k) => (store ? store.getItem(k) || "" : "");
  return {
    githubToken: get(KEYS.gh),
    llmKey: get(KEYS.llmKey),
    llmBase: get(KEYS.llmBase) || OPENROUTER_BASE,
    llmModel: get(KEYS.llmModel) || DEFAULT_MODELS[1].id,
    provider: get(KEYS.provider) || "openrouter",
  };
}

export function saveSettings(next) {
  const store = ls();
  if (!store) return;
  const set = (k, v) => {
    if (v) store.setItem(k, v);
    else store.removeItem(k);
  };
  set(KEYS.gh, (next.githubToken || "").trim());
  set(KEYS.llmKey, (next.llmKey || "").trim());
  set(KEYS.llmBase, (next.llmBase || "").trim());
  set(KEYS.llmModel, (next.llmModel || "").trim());
  set(KEYS.provider, (next.provider || "").trim());
}

export function clearSecrets() {
  saveSettings({
    githubToken: "",
    llmKey: "",
    llmBase: OPENROUTER_BASE,
    llmModel: DEFAULT_MODELS[1].id,
    provider: "openrouter",
  });
}
