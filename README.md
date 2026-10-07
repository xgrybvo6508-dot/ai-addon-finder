# AI Addon Finder

Статическая страница-агент: запрос на русском или английском → план поиска → живой GitHub Search → эвристические инсайты («для чего», «как поставить») + каталог. Live: [https://xgrybvo6508-dot.github.io/ai-addon-finder/](https://xgrybvo6508-dot.github.io/ai-addon-finder/)

## Что нельзя сделать со статического GitHub Pages

Страница живёт в браузере. Поэтому:

- **Нет сервера и нет секретов в репозитории.** Любой ключ в `js/` или Actions утёк бы в публичный Pages.
- **Cursor-модели недоступны.** Их вызывает только приложение Cursor, не `github.io`.
- **Perplexity / OpenAI / OpenRouter** — только если *вы* вставите свой ключ в Настройки (BYOK). Ключ пишется в `localStorage` этого браузера, на сервер не уходит.
- Без ключа агент всё равно работает: словарь понятий (RU→EN), GitHub REST без авторизации, эвристики по description / topics / README.

## Open locally

```bash
python3 -m http.server 8080
```

[http://localhost:8080](http://localhost:8080) — сборки нет (`index.html`, `css/`, `js/`, `data/`).

## Как устроен агент (без ключа)

1. **Понимаю запрос** — снимает воду, достаёт понятия (граф → knowledge graph, экономит токены → context compression, …), тип (плагин / MCP / расширение / библиотека). Чипы «Я понял» можно снять или дополнить и искать снова.
2. **Ищу на GitHub** — 3–5 разных подзапросов (без токена бюджет 4, с токеном 5; **10 req/min** без ключа). Не fork, не archived, `pushed` за 18 месяцев. Дедуп.
3. **Анализирую** — пересечение *всех* понятий с description, topics и README. На карточке: «почему подходит под твой запрос».
4. **Готово** — GitHub ∪ каталог. Только реальные `html_url`. Кэш `localStorage` 24 часа (ключ учитывает набор понятий).

При **429/403** показывается таймер до `X-RateLimit-Reset` и запасной каталог. Страница не падает.

## Настройки (опционально)

| Поле | Зачем |
| --- | --- |
| GitHub token | Поднять лимит Search. Только localStorage. |
| OpenRouter (по умолчанию) | Модели: **Perplexity Sonar**, GPT-4o mini, Gemini Flash, Claude Haiku. LLM собирает intent JSON (понятия, must-have, 3–5 запросов) и пишет «почему подходит» **только по найденным репозиториям**. |
| OpenAI-compatible URL | Свой endpoint. Браузер требует CORS на этом origin. |

Без ключа режим остаётся полным по функциональности, слабее по языку инсайтов.

## MCP в Cursor (сайт от MCP не зависит)

Папка [`mcp/`](mcp/) — stdio-сервер Node 18+, зависимость не нужна. Тот же `js/agent/pipeline.js`.

В `~/.cursor/mcp.json` или `.cursor/mcp.json` проекта:

```json
{
  "mcpServers": {
    "ai-addon-finder": {
      "command": "node",
      "args": ["/ABS/PATH/TO/ai-addon-finder/mcp/server.mjs"],
      "env": {
        "GITHUB_TOKEN": ""
      }
    }
  }
}
```

Подставьте абсолютный путь. `GITHUB_TOKEN` в `env` — по желанию (не коммитьте). Инструмент: `find_ai_addons` с аргументом `query`.

Проверка:

```bash
node mcp/server.mjs
```

и вызов tool из Cursor.

## GitHub Pages

После мержа в `main`:

1. **Settings → Pages → Source: GitHub Actions** (workflow `.github/workflows/pages.yml`), **или**
2. **Deploy from a branch** → `main` / `(root)`

URL: `https://xgrybvo6508-dot.github.io/ai-addon-finder/`

`mcp/` на Pages не публикуется — только статика.

## Каталог

Правки в [`data/catalog.json`](data/catalog.json): `id`, `name`, `url`, `category` (`cursor|obsidian|mcp|browser|catalog|skill`), `tags`, `stars`, `insight_ru`, `insight_en`, `keywords`.
