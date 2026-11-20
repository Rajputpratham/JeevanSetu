/**
 * Generic in-process TTL cache for server-side API routes.
 *
 * Google bills per request, so every route that proxies a billed upstream
 * (Routes, Geocoding, Places) keeps a short-lived cache. This factory gives each
 * route its OWN store — clearing travel entries must never evict rating entries,
 * and a key collision between endpoints must be impossible.
 *
 * Behaviour:
 *   • `read`/`write` are the primitives; `cached` is the usual entry point.
 *   • `cached` collapses concurrent identical requests into one in-flight
 *     promise so a burst of page loads triggers a single upstream call.
 *   • Entries are dropped on expiry, never evicted early, and nothing is
 *     persisted: keys are derived from request parameters only.
 */

export interface TtlCacheOptions {
  /** Soft cap on live entries; the oldest key is dropped first. Default 400. */
  maxEntries?: number;
}

export interface TtlCache {
  /** Returns the cached value, or `null` when absent/expired. */
  read<T>(key: string): T | null;
  write<T>(key: string, value: T, ttlMs: number): void;
  /** Cache-through helper: resolves from cache, in-flight work, or `fn`. */
  cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
  clear(): void;
  stats(): { entries: number; inFlight: number };
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export function createTtlCache(options: TtlCacheOptions = {}): TtlCache {
  const maxEntries = options.maxEntries ?? 400;
  const store = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<unknown>>();

  function read<T>(key: string): T | null {
    const hit = store.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return hit.value as T;
  }

  function write<T>(key: string, value: T, ttlMs: number): void {
    if (!store.has(key) && store.size >= maxEntries) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = read<T>(key);
    if (hit !== null) return hit;

    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fn()
      .then((value) => {
        write(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  }

  return {
    read,
    write,
    cached,
    clear() {
      store.clear();
      inFlight.clear();
    },
    stats() {
      return { entries: store.size, inFlight: inFlight.size };
    },
  };
}
