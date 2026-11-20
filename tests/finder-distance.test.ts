import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDistance, forgetDistanceFallback, getDrivingDistances, haversineKm, isLatLng, type Hospital } from '@/lib/distance';

const delhi = { lat: 28.6139, lng: 77.209 };
const gurugram = { lat: 28.4595, lng: 77.0266 };
const aiims = (id: string) => ({ id, lat: 28.5671, lng: 77.2089 });
const table = (distances: unknown, durations: unknown) => Response.json({ code: 'Ok', distances: [distances], durations: [durations] });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('calculates the Delhi–Gurugram straight-line distance', () => {
  expect(haversineKm(delhi, gurugram)).toBeGreaterThan(23);
  expect(haversineKm(delhi, gurugram)).toBeLessThan(26);
  expect(haversineKm(delhi, delhi)).toBe(0);
});

it('formats each source without offering a drive time for straight lines', () => {
  expect(formatDistance({ id: '1', source: 'road', km: 4.2, minutes: 14.6 })).toBe('4.2 km · 15 min drive');
  expect(formatDistance({ id: '2', source: 'straight-line', km: 3.8, minutes: null })).toBe('approx. 3.8 km (straight line)');
  expect(formatDistance({ id: '3', source: 'none', km: null, minutes: null })).toBe('Distance unavailable');
  expect(formatDistance()).toBe('Distance unavailable');
});

it('aligns longitude/latitude and columns to the correct IDs, including null and zero routes', async () => {
  fetchMock.mockResolvedValueOnce(table([0, 4200, null, 0], [0, 900, 870, 0]));
  const hospitals = [aiims('map-road'), { id: 'map-missing' }, { id: 'map-null', ...gurugram }, { id: 'map-zero', ...delhi }];
  const results = await getDrivingDistances(delhi, hospitals);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect(url.pathname).toBe('/table/v1/driving/77.209,28.6139;77.2089,28.5671;77.0266,28.4595;77.209,28.6139');
  expect(url.searchParams.get('sources')).toBe('0');
  expect(url.searchParams.get('annotations')).toBe('distance,duration');
  expect(results).toEqual([
    { id: 'map-road', source: 'road', km: 4.2, minutes: 15 },
    { id: 'map-missing', source: 'none', km: null, minutes: null },
    { id: 'map-null', source: 'straight-line', km: haversineKm(delhi, gurugram), minutes: null },
    { id: 'map-zero', source: 'road', km: 0, minutes: 0 },
  ]);
});

it('rejects partial, non-number, non-finite and out-of-range pairs without sending them', async () => {
  const bad = [{ lat: 28 }, { lat: NaN, lng: 77 }, { lat: 91, lng: 77 }, { lat: 28, lng: -181 },
    { lat: Infinity, lng: 77 }, { lat: '28', lng: 77 }, { lat: null, lng: null }];
  expect(bad.every((item) => !isLatLng(item))).toBe(true);
  expect(isLatLng({ lat: -90, lng: 180 })).toBe(true);
  expect(await getDrivingDistances(delhi, bad.map((item, i) => ({ id: `bad-${i}`, ...item }) as Hospital))).toEqual(
    bad.map((_, i) => ({ id: `bad-${i}`, source: 'none', km: null, minutes: null })));
  expect(await getDrivingDistances({ lat: -91, lng: 45 }, [aiims('no-origin')])).toEqual([
    { id: 'no-origin', source: 'none', km: null, minutes: null },
  ]);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  ['429', () => Promise.resolve(new Response(null, { status: 429 }))],
  ['rejected fetch', () => Promise.reject(new Error('offline'))],
  ['shape mismatch', () => Promise.resolve(table([4200], [0, 900]))],
  ['negative duration', () => Promise.resolve(table([0, 4200], [0, -42]))],
  ['string distance', () => Promise.resolve(table([0, '4200'], [0, 900]))],
  ['invalid JSON', () => Promise.resolve(new Response('not JSON'))],
])('falls back without an ETA for %s', async (label, answer) => {
  fetchMock.mockImplementationOnce(answer);
  const hospital = aiims(`fallback-${label}`);
  expect(await getDrivingDistances(delhi, [hospital])).toEqual([
    { id: hospital.id, source: 'straight-line', km: haversineKm(delhi, hospital), minutes: null },
  ]);
});

it('aborts at eight seconds and falls back', async () => {
  vi.useFakeTimers();
  fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) =>
    options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
  const promise = getDrivingDistances(delhi, [aiims('timeout')]);
  await vi.advanceTimersByTimeAsync(8000);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  await expect(promise).resolves.toMatchObject([{ id: 'timeout', source: 'straight-line', minutes: null }]);
});

it('chunks at 100 total coordinates, preserving global input order', async () => {
  const hospitals = Array.from({ length: 206 }, (_, i) => aiims(`chunk-${i}`));
  fetchMock.mockImplementation(async (input) => {
    const n = new URL(String(input)).pathname.split('/').at(-1)!.split(';').length;
    return table(Array.from({ length: n }, (_, column) => column * 1000), Array(n).fill(120));
  });
  const result = await getDrivingDistances(delhi, hospitals);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(result.map(({ id }) => id)).toEqual(hospitals.map(({ id }) => id));
  expect([0, 98, 99, 197, 198, 205].map((i) => result[i].km)).toEqual([1, 99, 1, 99, 1, 8]);
});

describe('routing cache', () => {
  it('shares overlapping in-flight work and reuses cached results in a different order and nearby origin', async () => {
    fetchMock.mockResolvedValueOnce(table([0, 4200, 11000], [0, 900, 1800]));
    const a = aiims('cache-a'), b = { id: 'cache-b', ...gurugram };
    const first = getDrivingDistances(delhi, [a, b]);
    const second = getDrivingDistances(delhi, [b]);
    const [ra, rb] = await first;
    expect(await second).toEqual([rb]);
    expect(await getDrivingDistances({ ...delhi, lat: delhi.lat + 0.003 }, [b, a])).toEqual([rb, ra]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(table([0, 4200], [0, 900]));
    await getDrivingDistances({ ...delhi, lat: delhi.lat + 0.01 }, [a]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('expires entries after 15 minutes and does not reuse a changed destination', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => table([0, 4200], [0, 900]));
    const a = aiims('expire');
    await getDrivingDistances(delhi, [a]);
    await vi.advanceTimersByTimeAsync(899_999);
    await getDrivingDistances(delhi, [a]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await getDrivingDistances(delhi, [a]);
    await getDrivingDistances(delhi, [{ ...a, lng: a.lng + 0.001 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries just the explicitly invalidated fallback', async () => {
    fetchMock.mockResolvedValueOnce(table([0, null, 6000], [0, null, 1000]));
    const a = aiims('retry-a'), b = aiims('retry-b');
    await getDrivingDistances(delhi, [a, b]);
    forgetDistanceFallback(delhi, a);
    fetchMock.mockResolvedValueOnce(table([0, 4200], [0, 900]));
    expect(await getDrivingDistances(delhi, [a, b])).toMatchObject([{ source: 'road', km: 4.2 }, { source: 'road', km: 6 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[1][0])).pathname.split(';')).toHaveLength(2);
  });
});
