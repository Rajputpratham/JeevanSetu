/**
 * Global test setup: keep the unit suite hermetic.
 *
 * Every external HTTP call fails loudly. Tests must stub `fetch` (or mock the
 * module that performs the call) instead of relying on the network, because a
 * developer machine and a CI runner do not have the same reachability — which is
 * exactly how a suite goes green locally and red on CI, or worse, silently
 * depends on a public demo service.
 *
 * Loopback is allowed so tests may talk to a locally-started server if needed.
 * Tests that replace `fetch` themselves (`vi.stubGlobal('fetch', …)`) take
 * precedence over this guard.
 */
const realFetch = globalThis.fetch;

const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  if (!isLocal(url)) {
    throw new Error(
      `External network is disabled in unit tests (${url}). Stub fetch or mock the provider module.`,
    );
  }
  return realFetch(input, init);
}) as typeof fetch;
