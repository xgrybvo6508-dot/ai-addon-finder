export class RateLimitError extends Error {
  constructor(resetAt, message = "GitHub rate limit") {
    super(message);
    this.name = "RateLimitError";
    this.resetAt = resetAt instanceof Date ? resetAt : new Date(resetAt);
  }
}

function headers(token) {
  const h = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-addon-finder",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function resetFrom(res) {
  const reset = Number(res.headers.get("x-ratelimit-reset") || 0) * 1000;
  const retry = Number(res.headers.get("retry-after") || 0) * 1000;
  return new Date(Math.max(reset, Date.now() + retry, Date.now() + 30_000));
}

async function githubJson(url, { token, fetchFn, signal }) {
  const res = await fetchFn(url, { headers: headers(token), signal });
  if (res.status === 403 || res.status === 429) {
    throw new RateLimitError(resetFrom(res));
  }
  if (!res.ok) {
    const err = new Error(`GitHub HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function searchRepositories(query, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const perPage = options.perPage || 10;
  const url =
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}` +
    `&per_page=${perPage}`;
  const data = await githubJson(url, {
    token: options.token,
    fetchFn,
    signal: options.signal,
  });
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchReadme(repo, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const branch = repo.default_branch || "main";
  const names = ["README.md", "readme.md", "README.MD", "Readme.md"];
  for (const name of names) {
    const raw = `https://raw.githubusercontent.com/${repo.full_name}/${branch}/${name}`;
    try {
      const res = await fetchFn(raw, { signal: options.signal });
      if (res.ok) {
        const text = await res.text();
        if (text && !text.startsWith("404")) return text.slice(0, 8000);
      }
    } catch {
      /* try next */
    }
  }
  return "";
}

export function isFreshEnough(repo, months = 18) {
  if (!repo?.pushed_at) return false;
  const limit = new Date();
  limit.setMonth(limit.getMonth() - months);
  return new Date(repo.pushed_at) >= limit;
}

export function isUsableRepo(repo, minStars = 3) {
  if (!repo || repo.archived || repo.fork) return false;
  if ((repo.stargazers_count || 0) < minStars) return false;
  if (!isFreshEnough(repo, 18)) return false;
  if (!repo.html_url || !/github\.com\//i.test(repo.html_url)) return false;
  return true;
}
