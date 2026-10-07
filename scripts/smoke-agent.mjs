import { readFileSync } from "node:fs";
import { extractConcepts } from "../js/agent/concepts.js";
import { buildPlan } from "../js/agent/plan.js";
import { runAgent, RateLimitError } from "../js/agent/pipeline.js";
import { memoryStore } from "../js/agent/cache.js";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")).items;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const queries = [
  "найти плагин, который позволяет ИИ последовательно работать с помощью графа, который он сам создал, и это экономит токены",
  "хочу чтобы ИИ запоминал мои заметки из Obsidian и сам предлагал связи между ними",
  "что-то что само читает мой телеграм канал и пишет дайджест через нейросеть",
  "агент который сам кликает в браузере и заполняет формы за меня",
  "I need a tool that builds a graph of my codebase so the coding agent pulls only relevant files and spends fewer tokens",
];

console.log("=== concepts ===");
for (const q of queries) {
  const ex = extractConcepts(q);
  const p = buildPlan(q);
  console.log("\nQ:", q);
  console.log(" chips:", ex.concepts.map((c) => c.label).join(" · "));
  console.log(" queries:", p.queries.length);
  p.queries.forEach((x) => console.log("  -", x));
}

async function runOne(q) {
  const result = await runAgent(q, {
    catalog,
    githubToken: token,
    persist: false,
    store: memoryStore(),
    skipCache: true,
  });
  const urls = result.cards.map((c) => c.url);
  const bad = urls.filter((u) => !/^https:\/\/github\.com\/[^/]+\/[^/]+/i.test(u));
  return { q, result, bad };
}

console.log("\n=== live (no LLM) ===");
const reports = [];
for (const q of queries) {
  const row = await runOne(q);
  reports.push(row);
  const top = row.result.cards.slice(0, 3);
  console.log("\nQ:", q.slice(0, 72) + (q.length > 72 ? "…" : ""));
  console.log(" cards", row.result.cards.length, "empty", row.result.empty, "rate", !!row.result.rateLimit);
  top.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name}  ${c.url}`);
    console.log(`     why: ${c.why_ru || "-"}`);
  });
  console.log(" bad urls", row.bad.length);
}

console.log("\n=== rate-limit mock ===");
const limited = await runAgent(queries[2], {
  catalog,
  persist: false,
  store: memoryStore(),
  skipCache: true,
  fetchFn: async () => {
    throw new RateLimitError(new Date(Date.now() + 45_000));
  },
});
console.log("fallback", limited.fallback, "cards", limited.cards.length);

const failed = reports.filter((r) => r.result.empty || r.bad.length > 0);
console.log("\n=== summary ===");
console.log("failed", failed.map((f) => f.q.slice(0, 40)));
if (failed.length) process.exitCode = 1;
