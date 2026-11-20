import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';

const submit = (query: string) => new NextRequest('http://localhost/api/geocode/finder', {
  method: 'POST', body: JSON.stringify({ query }), headers: { 'Content-Type': 'application/json' },
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it('validates PINs, returns separate locality candidates and rate limits uncached lookups', async () => {
  vi.useFakeTimers();
  vi.stubEnv('NOMINATIM_SEARCH_URL', 'https://example.test/search');
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([
    { lat: '28.4595', lon: '77.0266', display_name: 'Gurugram, Haryana', addresstype: 'city' },
    { lat: '29', lon: '80', display_name: 'Another locality', addresstype: 'town' },
    { lat: '', lon: '77.02', display_name: 'Bad coordinate', addresstype: 'town' },
    { lat: '29', lon: '77', display_name: 'Not a city or locality', addresstype: 'hospital' },
  ])).mockResolvedValueOnce(Response.json([
    { lat: '28.4', lon: '77.0', display_name: '122001, Haryana', address: { postcode: '122001' } },
    { lat: '28.9', lon: '77.5', display_name: 'Other pincode', address: { postcode: '122002' } },
  ]));
  vi.stubGlobal('fetch', fetchMock);
  const { POST } = await import('@/app/api/geocode/finder/route');
  expect((await POST(submit('123'))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
  const first = POST(submit('Gurugram'));
  const repeat = POST(submit(' gurugram '));
  expect(await (await first).json()).toEqual({ results: [
    { lat: 28.4595, lng: 77.0266, label: 'Gurugram, Haryana' }, { lat: 29, lng: 80, label: 'Another locality' },
  ] });
  expect((await repeat).status).toBe(200);
  expect((await POST(submit('122001'))).status).toBe(429);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toMatch(/JeevanSetu.*github.com/);
  await vi.advanceTimersByTimeAsync(1100);
  expect(await (await POST(submit('122001'))).json()).toEqual({ results: [{ lat: 28.4, lng: 77, label: '122001, Haryana' }] });
  expect((fetchMock.mock.calls[1][0] as URL).searchParams.get('postalcode')).toBe('122001');
});
