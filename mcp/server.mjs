#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "../js/agent/pipeline.js";
import { memoryStore } from "../js/agent/cache.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(root, "data/catalog.json"), "utf8"));
const items = Array.isArray(catalog) ? catalog : catalog.items || [];

const TOOLS = [
  {
    name: "find_ai_addons",
    description:
      "Search GitHub and the curated catalog for AI addons (MCP servers, Obsidian plugins, Cursor rules, Chrome agents). Returns ranked repos with insights. Optional GITHUB_TOKEN env raises the unauthenticated 10 req/min Search limit.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "User prompt in Russian or English",
        },
      },
      required: ["query"],
    },
  },
];

function writeMessage(msg) {
  const json = Buffer.from(JSON.stringify(msg), "utf8");
  process.stdout.write(`Content-Length: ${json.length}\r\n\r\n`);
  process.stdout.write(json);
}

function ok(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function fail(id, code, message) {
  writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

async function callFind(query) {
  const result = await runAgent(query, {
    catalog: items,
    persist: false,
    skipCache: false,
    store: memoryStore(),
    githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
  });
  return {
    query,
    english: result.plan?.english,
    queries: result.plan?.queries,
    rateLimit: result.rateLimit,
    fallback: result.fallback,
    results: (result.cards || []).map((c) => ({
      name: c.name,
      url: c.url,
      stars: c.stars,
      insight_ru: c.insight_ru,
      install_ru: c.install_ru,
      source: c.source,
      tags: c.tags,
    })),
  };
}

async function handle(msg) {
  if (!msg || msg.jsonrpc !== "2.0") return;
  const { id, method, params } = msg;
  if (method === "initialize") {
    ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "ai-addon-finder", version: "1.0.0" },
    });
    return;
  }
  if (method === "notifications/initialized" || method === "initialized") return;
  if (method === "ping") {
    ok(id, {});
    return;
  }
  if (method === "tools/list") {
    ok(id, { tools: TOOLS });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments || {};
    if (name !== "find_ai_addons") {
      fail(id, -32601, `Unknown tool: ${name}`);
      return;
    }
    const query = String(args.query || "").trim();
    if (!query) {
      fail(id, -32602, "query is required");
      return;
    }
    try {
      const data = await callFind(query);
      ok(id, {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    } catch (err) {
      ok(id, {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      });
    }
    return;
  }
  if (id !== undefined) fail(id, -32601, `Unknown method: ${method}`);
}

async function main() {
  let buf = Buffer.alloc(0);
  for await (const chunk of process.stdin) {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = buf.slice(0, headerEnd).toString("utf8");
      const match = header.match(/content-length:\s*(\d+)/i);
      if (!match) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const start = headerEnd + 4;
      if (buf.length < start + len) break;
      const body = buf.slice(start, start + len).toString("utf8");
      buf = buf.slice(start + len);
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        continue;
      }
      await handle(parsed);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
