import { OPENROUTER_BASE } from "./settings.js";

function extractJson(text) {
  const raw = String(text || "").trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : raw;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{") === -1 ? body.indexOf("[") : body.indexOf("{");
    const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function chatJson({
  key,
  base = OPENROUTER_BASE,
  model,
  system,
  user,
  fetchFn,
  signal,
}) {
  if (!key || !model) return null;
  const url = `${String(base || OPENROUTER_BASE).replace(/\/$/, "")}/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  if (/openrouter\.ai/i.test(url)) {
    headers["HTTP-Referer"] = "https://xgrybvo6508-dot.github.io/ai-addon-finder/";
    headers["X-Title"] = "AI Addon Finder";
  }
  const res = await (fetchFn || fetch)(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = new Error(`LLM HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  return extractJson(text);
}

export async function rewritePlanWithLlm(query, plan, llm, fetchFn, signal) {
  try {
    return await chatJson({
      ...llm,
      fetchFn,
      signal,
      system:
        'Turn a long user prompt into GitHub search intent. Return JSON only: {"english":"...","intent":"plugin|mcp|extension|library|agent","concepts":[{"id":"slug","label":"ru","terms":["en",...]}],"mustHave":["id"],"niceToHave":["id"],"keywords":["..."],"queries":["q1","q2","q3"]}. 3-5 queries. No URLs. No invented repos.',
      user: `User prompt:\n${query}\n\nHeuristic:\n${JSON.stringify({
        english: plan.english,
        concepts: (plan.concepts || []).map((c) => ({
          id: c.id,
          label: c.label,
          terms: c.terms,
        })),
        queries: plan.queries,
        artifacts: plan.artifacts,
      })}`,
    });
  } catch {
    return null;
  }
}

export async function polishInsightsWithLlm(query, cards, llm, fetchFn, signal) {
  const allowed = new Map(cards.map((c) => [c.url, c]));
  const context = cards.map((c) => ({
    url: c.url,
    name: c.name,
    description: c.description || "",
    topics: c.tags || [],
    matched: (c.matchedConcepts || []).map((x) => x.label || x),
    readme: (c.readme || "").slice(0, 900),
  }));
  try {
    const json = await chatJson({
      ...llm,
      fetchFn,
      signal,
      system:
        "Explain why each provided GitHub repo fits the user need. Return JSON array [{url, insight_ru, install_ru, why_ru}]. why_ru starts with «Почему подходит под твой запрос:». Use only given urls. No new repos. 1–2 sentences.",
      user: `Need: ${query}\nRepos:\n${JSON.stringify(context)}`,
    });
    if (!Array.isArray(json)) return cards;
    return cards.map((card) => {
      const hit = json.find((row) => row && row.url === card.url);
      if (!hit || !allowed.has(card.url)) return card;
      return {
        ...card,
        insight_ru: String(hit.insight_ru || card.insight_ru).slice(0, 320),
        install_ru: String(hit.install_ru || card.install_ru).slice(0, 280),
        why_ru: String(hit.why_ru || card.why_ru || "").slice(0, 280),
        llm: true,
      };
    });
  } catch {
    return cards;
  }
}
