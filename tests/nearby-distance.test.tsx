/**
 * Regression coverage for the "hospitals near you" listing on the home page.
 *
 * Reported bug: every card showed orange "Driving distance unavailable" even
 * though the addresses are known. The listing must request the device location
 * once on page load (gracefully), compute real driving distance + duration via
 * the key-free OSRM table API (falling back to server Google Routes figures
 * when present), and degrade per card when routing fails — never breaking the
 * page, never guessing a number.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/lib/i18n';
import { SavedProvider } from '@/lib/saved';
import { CompareProvider } from '@/lib/compare';
import { LocationProvider } from '@/lib/useLocation';
import NearbySection from '@/components/home/NearbySection';
import { HOSPITALS } from '@/data/hospitals';

const aiims = HOSPITALS.find((h) => h.id === 'aiims-new-delhi')!;
const safdarjung = HOSPITALS.find((h) => h.id === 'safdarjung-hospital')!;
const rml = HOSPITALS.find((h) => h.id === 'rml-hospital')!;
const lokNayak = HOSPITALS.find((h) => h.id === 'lok-nayak-hospital')!;
const FOUR = [aiims, safdarjung, rml, lokNayak].map((h) => ({
  ...h,
  // /api/hospitals without usable Google credentials returns null distances.
  distanceKm: null,
  roadKm: null,
  straightKm: null,
  etaMinutes: null,
  staticMinutes: null,
  trafficImpactMinutes: null,
  travelSource: 'unavailable',
  communityScore: null,
  imdbScore: null,
  reviewCount: 0,
}));

const DELHI = { latitude: 28.6139, longitude: 77.209, accuracy: 15 } as GeolocationCoordinates;
const GURUGRAM = { latitude: 28.4595, longitude: 77.0266, accuracy: 15 } as GeolocationCoordinates;

// Verified registry coordinates (what the OSRM fallback sends).
const OSRM_M: Record<string, { m: number; s: number }> = {
  '77.2089,28.5671': { m: 4800, s: 720 }, // AIIMS — 4.8 km, 12 min
  '77.2075,28.5664': { m: 4900, s: 780 }, // Safdarjung — 4.9 km, 13 min
  '77.1998,28.6259': { m: 6300, s: 1140 }, // RML — 6.3 km, 19 min
  '77.2382,28.6404': { m: 7600, s: 1260 }, // Lok Nayak — 7.6 km, 21 min
};

const tableResponse = (url: string) => {
  const path = new URL(url).pathname; // /table/v1/driving/lng,lat;...
  const coords = decodeURIComponent(path.split('/driving/')[1] ?? '').split(';');
  const meters = coords.map((c, i) => (i === 0 ? 0 : OSRM_M[c]?.m ?? null));
  const seconds = coords.map((c, i) => (i === 0 ? 0 : OSRM_M[c]?.s ?? null));
  return Response.json({ code: 'Ok', distances: [meters], durations: [seconds] });
};

const fetchMock = vi.fn<typeof fetch>();
const device = vi.fn<Geolocation['getCurrentPosition']>();
const geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

const respondToFetch = ({ osrmFails = false } = {}) =>
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/api/hospitals?')) return Response.json({ results: FOUR, fellBack: false });
    if (url.includes('/api/geocode/reverse')) return Response.json({ label: 'Connaught Place, New Delhi' });
    if (url.includes('/table/')) {
      if (osrmFails) throw new Error('network down');
      return tableResponse(url);
    }
    throw new Error(`unexpected fetch: ${url}`);
  });

const wrap = (children: React.ReactNode) => (
  <LanguageProvider>
    <SavedProvider>
      <CompareProvider>
        <LocationProvider>{children}</LocationProvider>
      </CompareProvider>
    </SavedProvider>
  </LanguageProvider>
);

const card = (id: string) => within(document.getElementById(`hospital-card-${id}`)!);

beforeEach(() => {
  fetchMock.mockReset();
  device.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('isSecureContext', true);
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: device },
  });
});

afterEach(() => {
  cleanup();
  if (geolocationDescriptor) Object.defineProperty(navigator, 'geolocation', geolocationDescriptor);
  else Reflect.deleteProperty(navigator, 'geolocation');
  vi.unstubAllGlobals();
});

describe('NearbySection — driving distance on hospital cards', () => {
  it('requests geolocation on page load and shows real km + ETA per card', async () => {
    respondToFetch();
    device.mockImplementation((success) =>
      success({ coords: DELHI, timestamp: Date.now() } as GeolocationPosition),
    );
    render(wrap(<NearbySection />));

    // The device prompt is fired without any user interaction.
    expect(device).toHaveBeenCalledTimes(1);

    // Cards render once the directory list resolves.
    await screen.findByText(aiims.name);
    expect(await card('aiims-new-delhi').findByText('4.8 km')).toBeInTheDocument();
    expect(card('aiims-new-delhi').getByText(/12 min/)).toBeInTheDocument();
    expect(card('safdarjung-hospital').getByText('4.9 km')).toBeInTheDocument();
    expect(card('safdarjung-hospital').getByText(/13 min/)).toBeInTheDocument();
    expect(card('rml-hospital').getByText('6.3 km')).toBeInTheDocument();
    expect(card('rml-hospital').getByText(/19 min/)).toBeInTheDocument();
    expect(card('lok-nayak-hospital').getByText('7.6 km')).toBeInTheDocument();
    expect(card('lok-nayak-hospital').getByText(/21 min/)).toBeInTheDocument();

    // The reported bug text must be gone once location + routing are available.
    expect(screen.queryByText('Driving distance unavailable')).not.toBeInTheDocument();
    // Exactly one OSRM table call for the four cards (cached, not per render).
    const tableCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/table/'));
    expect(tableCalls).toHaveLength(1);
  });

  it('shows the enable-location fallback on every card when permission is denied', async () => {
    respondToFetch();
    device.mockImplementation((_success, error) =>
      error?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    );
    render(wrap(<NearbySection />));

    expect(await screen.findAllByText('Enable location to see driving distance.')).toHaveLength(4);
    expect(screen.queryByText('Driving distance unavailable')).not.toBeInTheDocument();
    // Directory is still browsable — no crash, all four Delhi hospitals render.
    expect(document.getElementById('hospital-card-aiims-new-delhi')).not.toBeNull();
    expect(fetchMock.mock.calls.some(([i]) => String(i).includes('/table/'))).toBe(false);
  });

  it('keeps a per-card driving-distance fallback when the routing API fails, without breaking the page', async () => {
    respondToFetch({ osrmFails: true });
    device.mockImplementation((success) =>
      success({ coords: GURUGRAM, timestamp: Date.now() } as GeolocationPosition),
    );
    render(wrap(<NearbySection />));

    // All four cards keep the original orange fallback text individually…
    await waitFor(() =>
      expect(screen.getAllByText('Driving distance unavailable')).toHaveLength(4),
    );
    // …while the page itself stays intact and no fake number is shown.
    expect(document.getElementById('hospital-card-aiims-new-delhi')).toBeInTheDocument();
    expect(document.getElementById('hospital-card-safdarjung-hospital')).toBeInTheDocument();
    expect(document.getElementById('hospital-card-rml-hospital')).toBeInTheDocument();
    expect(document.getElementById('hospital-card-lok-nayak-hospital')).toBeInTheDocument();
    expect(screen.queryByText(/km · /)).not.toBeInTheDocument();
  });
});
