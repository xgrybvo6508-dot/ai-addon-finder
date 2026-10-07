const PREFIX = "aaf:cache:v2:";
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function cacheKey(query, extra = "") {
  const q = String(query || "").trim().toLowerCase().replace(/\s+/g, " ");
  const x = String(extra || "").trim();
  return PREFIX + q + (x ? `::${x}` : "");
}

export function memoryStore() {
  const map = new Map();
  return {
    get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    set(key, value) {
      map.set(key, value);
    },
  };
}

export function localStorageStore() {
  let ls = null;
  try {
    ls = globalThis.localStorage;
  } catch {
    ls = null;
  }
  if (!ls) return memoryStore();
  return {
    get(key) {
      try {
        const raw = ls.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        ls.setItem(key, JSON.stringify(value));
      } catch {
        /* quota */
      }
    },
  };
}

export function readCache(store, query, extra = "") {
  const row = store.get(cacheKey(query, extra));
  if (!row || typeof row !== "object") return null;
  if (Date.now() - Number(row.ts || 0) > CACHE_TTL_MS) return null;
  return row.payload || null;
}

export function writeCache(store, query, payload, extra = "") {
  store.set(cacheKey(query, extra), { ts: Date.now(), payload });
}
