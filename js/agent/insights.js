import { normalize } from "./text.js";

const KIND_RU = {
  mcp: "MCP-сервер",
  obsidian: "Плагин Obsidian",
  browser: "Браузерный агент / расширение",
  cursor: "Инструмент для Cursor",
  skill: "Skill / правила агента",
  catalog: "Каталог",
};

const INSTALL_RU = {
  mcp: "Cursor: Settings → MCP или `.cursor/mcp.json`. Команда запуска — в README репозитория.",
  obsidian:
    "Obsidian → Settings → Community plugins → Browse, либо папка `.obsidian/plugins/`.",
  browser:
    "Chrome → Расширения → Load unpacked, или ссылка на Web Store в README.",
  cursor:
    "Скопируйте rules/skill в `.cursor/rules` или `.cursor/skills` проекта.",
  skill: "Установите skill в каталог агента (например `~/.cursor/skills/`) — см. README.",
  catalog: "Откройте README — там список ссылок и как выбрать нужный пункт.",
};

export function detectKind(repo, plan) {
  const blob = normalize(
    `${repo.full_name} ${repo.description || ""} ${(repo.topics || []).join(" ")}`
  );
  if (blob.includes("mcp") || (repo.topics || []).includes("mcp-server")) return "mcp";
  if (blob.includes("obsidian")) return "obsidian";
  if (
    blob.includes("chrome") ||
    blob.includes("extension") ||
    blob.includes("browser")
  ) {
    return "browser";
  }
  if (blob.includes("cursorrules") || blob.includes("skill")) return "skill";
  if (blob.includes("cursor")) return "cursor";
  return plan.intents?.[0]?.category || "catalog";
}

function firstSentence(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const cut = clean.split(/(?<=[.!?])\s/)[0];
  return cut.slice(0, 220);
}

function extractInstall(readme) {
  if (!readme) return "";
  const lines = readme.split(/\r?\n/).slice(0, 120);
  const block = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      if (!inFence && block.length) break;
      continue;
    }
    if (inFence) {
      if (/npx |npm i|npm install|uvx |pip install|npx skills/.test(line)) {
        block.push(line.trim());
      } else if (block.length) block.push(line.trim());
      if (block.join(" ").length > 180) break;
    }
  }
  if (block.length) return block.join(" ").slice(0, 200);
  const hit = lines.find((l) =>
    /npx |npm i |uvx |Community plugins|mcp\.json/.test(l)
  );
  return hit ? hit.replace(/^#+\s*/, "").slice(0, 180) : "";
}

export function buildInsights(repo, plan, readme = "") {
  const kind = detectKind(repo, plan);
  const desc = firstSentence(repo.description);
  const prefix = KIND_RU[kind] || "AI-аддон";
  const insight_ru = desc ? `${prefix}: ${desc}` : `${prefix} «${repo.name}».`;
  const insight_en = desc || repo.full_name;
  const fromReadme = extractInstall(readme);
  const install_ru = fromReadme
    ? `Как поставить: ${fromReadme}`
    : `Как поставить: ${INSTALL_RU[kind]}`;
  return { kind, insight_ru, insight_en, install_ru };
}

export { KIND_RU, INSTALL_RU };
