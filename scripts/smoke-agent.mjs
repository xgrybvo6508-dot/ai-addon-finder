import { readFileSync } from "node:fs";
import { buildPlan } from "../js/agent/plan.js";
import { runAgent, RateLimitError } from "../js/agent/pipeline.js";
import { memoryStore } from "../js/agent/cache.js";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")).items;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const queries = [
  "плагин для Obsidian с ИИ",
  "MCP для Telegram",
  "cursor rules",
  "расширение хром для ИИ агента",
  "notion ai automation",
  "zxqwyv-unknown-term-zzz",
];

console.log("=== plans ===");
for (const q of queries) {
  const p = buildPlan(q);
  console.log("\nQ:", q);
  console.log(" EN:", p.english);
  console.log(" intents:", p.intents.map((i) => i.id).join(",") || "-");
  console.log(" queries:", p.queries.length);
  p.queries.forEach((x) => console.log("  -", x));
}

async function runOne(q) {
  const steps = [];
  const result = await runAgent(q, {
    catalog,
    githubToken: token,
    persist: false,
    store: memoryStore(),
    skipCache: true,
    onStep: (id, state) => steps.push(`${id}:${state}`),
  });
  const urls = result.cards.map((c) => c.url);
  const bad = urls.filter((u) => !/^https:\/\/github\.com\/[^/]+\/[^/]+/i.test(u));
  return { q, result, steps, bad };
}

console.log("\n=== live (no LLM) ===");
const reports = [];
for (const q of queries) {
  const row = await runOne(q);
  reports.push(row);
  const names = row.result.cards.slice(0, 5).map((c) => `${c.name} (${c.source})`).join(" | ");
  console.log("\nQ:", q);
  console.log(" steps", row.steps.filter((s) => s.endsWith("done")).join(" → "));
  console.log(" cards", row.result.cards.length, "fallback", row.result.fallback, "empty", row.result.empty);
  console.log(" top:", names || "(none)");
  console.log(" bad urls", row.bad.length, "rate", row.result.rateLimit);
}

console.log("\n=== rate-limit mock ===");
const limited = await runAgent("MCP для Telegram", {
  catalog,
  persist: false,
  store: memoryStore(),
  skipCache: true,
  fetchFn: async () => {
    const err = new RateLimitError(new Date(Date.now() + 45_000));
    throw err;
  },
});
console.log(
  "fallback",
  limited.fallback,
  "cards",
  limited.cards.length,
  "has telegram or catalog",
  limited.cards.some((c) => /telegram|mcp/i.test(c.name + c.url))
);

const failed = reports.filter((r) => {
  if (r.q.includes("zzz")) return !r.result.empty && r.result.cards.some((c) => c.source === "github");
  return r.result.empty || r.bad.length > 0;
});
console.log("\n=== summary ===");
console.log("failed checks", failed.map((f) => f.q));
if (failed.length) process.exitCode = 1;
