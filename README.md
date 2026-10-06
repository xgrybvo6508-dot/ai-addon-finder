# AI Addon Finder

Одна статическая страница: вводите запрос на русском или английском — сайт ранжирует AI-аддоны (Cursor, Obsidian, MCP, skills, браузерные агенты). Бэкенда и API-ключей нет.

Live (после включения Pages):
[https://xgrybvo6508-dot.github.io/ai-addon-finder/](https://xgrybvo6508-dot.github.io/ai-addon-finder/)

## Open locally

Нужен любой HTTP-сервер: браузер не отдаст `data/catalog.json` по `file://`.

```bash
python3 -m http.server 8080
```

Откройте [http://localhost:8080](http://localhost:8080). Сборки нет: `index.html` + `css/` + `js/` + `data/`.

## GitHub Pages

Репозиторий готов к публикации с корня (`index.html`). Два варианта.

### A. GitHub Actions (предпочтительно)

1. **Settings → Pages**
2. **Build and deployment → Source:** GitHub Actions
3. После мержа в `main` workflow `.github/workflows/pages.yml` задеплоит сайт.
4. URL: `https://xgrybvo6508-dot.github.io/ai-addon-finder/`

Первый прогон Actions может попросить подтвердить environment `github-pages`.

### B. Deploy from a branch (без Actions)

1. **Settings → Pages**
2. **Source:** Deploy from a branch
3. Branch: `main`, folder: `/ (root)`
4. Save

Jekyll не нужен (в корне есть `.nojekyll`).

## Add catalog items

Правьте только [`data/catalog.json`](data/catalog.json). Поля элемента:

| Field | Notes |
| --- | --- |
| `id` | slug, уникальный |
| `name` | отображаемое имя |
| `url` | GitHub URL |
| `category` | `cursor` \| `obsidian` \| `mcp` \| `browser` \| `catalog` \| `skill` |
| `tags` | короткие ярлыки на карточке |
| `stars` | число звёзд, если известно |
| `insight_ru` / `insight_en` | «для чего» |
| `keywords` | токены для поиска (RU и EN) |

Поиск: токенизация запроса → пересечение с name / tags / keywords (плюс лёгкие синонимы). Если совпадений мало — показываются ближайшие результаты и подсказка расширить запрос.
