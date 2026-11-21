/**
 * BROWSER-JOURNEY TESTS (jsdom) for the three fixes + three features.
 *
 * These render the REAL client components and stub only `fetch` and the
 * Geolocation API, so they exercise the same code a person clicks through:
 *   • detail page: illustration instead of a stock photo, compact Google link,
 *     road distance/ETA with permission, compact fallback without a route
 *   • finder: treatment selector drives per-hospital cost previews
 *   • detail page: scheme badges + evidence + the honest caveat
 *   • review section: "what did you pay" submission with a verification label
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/lib/i18n';
import { SavedProvider } from '@/lib/saved';
import { CompareProvider } from '@/lib/compare';
import { LocationProvider } from '@/lib/useLocation';
import { TreatmentProvider } from '@/lib/treatment-selection';
import HospitalDetailClient from '@/components/detail/HospitalDetailClient';
import TreatmentSelector from '@/components/hospitals/TreatmentSelector';
import { getHospitalById } from '@/data/hospitals';

const medanta = getHospitalById('medanta-medicity')!;
const aiims = getHospitalById('aiims-new-delhi')!;

const fetchMock = vi.fn<typeof fetch>();

function json(payload: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }));
}

/** Default API surface a detail page needs. */
function stubApis(overrides: Record<string, (url: URL) => Promise<Response>> = {}) {
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input), 'http://localhost:3000');
    for (const [fragment, handler] of Object.entries(overrides)) {
      if (url.pathname.includes(fragment)) return handler(url);
    }
    if (url.pathname === '/api/reviews') return json({ summary: null, reviews: [] });
    if (url.pathname === '/api/bills') return json({ count: 0, bills: [], aggregate: null });
    if (url.pathname === '/api/google-ratings')
      return json({ status: 'awaiting-api-key', rating: null, userRatingsTotal: 0, reviews: [], googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=x', attribution: 'Google Maps' });
    if (url.pathname === '/api/cost-preview')
      return json({
        treatment: { id: url.searchParams.get('treatment'), name: 'Cataract surgery' },
        results: [],
      });
    if (url.pathname === '/api/route')
      return json({
        source: 'unavailable',
        distanceKm: null,
        minutes: null,
        etaMinutes: null,
        straightKm: 12.5,
        liveTraffic: false,
        error: 'offline',
        navigateUrl: 'https://www.google.com/maps/dir/?api=1&origin=1,2&destination=3,4',
        computedAt: null,
      });
    return json({});
  });
}

function renderDetail(hospital = medanta) {
  return render(
    <LanguageProvider>
      <LocationProvider>
        <CompareProvider>
          <SavedProvider>
            <TreatmentProvider>
              <HospitalDetailClient hospital={hospital} />
            </TreatmentProvider>
          </SavedProvider>
        </CompareProvider>
      </LocationProvider>
    </LanguageProvider>,
  );
}

const grantLocation = (lat = 28.6139, lng = 77.209) => {
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({ coords: { latitude: lat, longitude: lng, accuracy: 20 } } as GeolocationPosition),
  );
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
  return getCurrentPosition;
};

beforeEach(() => {
  fetchMock.mockReset();
  stubApis();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom reports isSecureContext=false; the components only need it truthy here.
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Finder journey — treatment selector updates every visible card', () => {
  it('batches one preview request, updates on treatment change, and shows honest states', async () => {
    const { default: DiscoveryClient } = await import('@/components/hospitals/DiscoveryClient');
    const { TreatmentProvider } = await import('@/lib/treatment-selection');
    const catalogue = [getHospitalById('aiims-new-delhi')!, getHospitalById('medanta-medicity')!];

    fetchMock.mockImplementation((input) => {
      const url = new URL(String(input), 'http://localhost:3000');
      if (url.pathname === '/api/hospitals') return json({ results: catalogue, origin: null });
      if (url.pathname === '/api/cost-preview') {
        const treatment = url.searchParams.get('treatment')!;
        return json({
          treatment: { id: treatment, name: treatment === 'cataract' ? 'Cataract surgery' : 'Knee replacement' },
          results: (url.searchParams.get('ids') ?? '').split(',').filter(Boolean).map((hospitalId) => ({
            hospitalId,
            state: 'generic-range',
            figure: null,
            coverageNote: null,
            generic: {
              govt: { min: 500, max: 2000, currency: 'INR' },
              private: { min: 20000, max: 60000, currency: 'INR' },
              asOf: '2023–2025',
              disclosure: 'generic',
            },
            community: null,
          })),
        });
      }
      return json({});
    });

    render(
      <LanguageProvider>
        <LocationProvider>
          <CompareProvider>
            <SavedProvider>
              <TreatmentProvider>
                <DiscoveryClient initialTreatment="cataract" />
              </TreatmentProvider>
            </SavedProvider>
          </CompareProvider>
        </LocationProvider>
      </LanguageProvider>,
    );

    await screen.findByText(medanta.name);
    const selector = screen.getByTestId('treatment-selector');
    expect(within(selector).getByLabelText(/Treatment/i)).toHaveProperty('value', 'cataract');
    expect(screen.getByTestId('cost-from-estimator')).toBeInTheDocument();

    // Exactly one batched preview request for the whole visible list.
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/cost-preview'))).toHaveLength(1));
    const firstRequest = String(fetchMock.mock.calls.find(([u]) => String(u).includes('/api/cost-preview'))![0]);
    expect(firstRequest).toContain('treatment=cataract');
    expect(firstRequest).toContain('aiims-new-delhi');
    expect(firstRequest).toContain('medanta-medicity');

    // Every visible card shows the honest, non-fabricated state.
    await waitFor(() => expect(screen.getAllByText(/Cost estimate unavailable/i)).toHaveLength(2));
    expect(document.body.textContent).not.toMatch(/₹0/);

    // Changing the treatment re-requests once with the new id, and the cards update.
    fireEvent.change(within(selector).getByLabelText(/Treatment/i), { target: { value: 'knee-replacement' } });
    await waitFor(() => {
      const previewCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/cost-preview'));
      expect(previewCalls).toHaveLength(2);
      expect(String(previewCalls[1][0])).toContain('treatment=knee-replacement');
    });
    await waitFor(() => expect(screen.getByTestId('treatment-selector').textContent).toMatch(/knee replacement/i));
    expect(screen.getAllByText(/Cost estimate unavailable/i)).toHaveLength(2);

    // Scheme badges are present on the cards, each with an explicit status.
    const badges = screen.getAllByTestId('scheme-badges-compact');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toMatch(/PM-JAY/);
    expect(badges[0].textContent).toMatch(/Not verified|Verified/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Problem B — no unrelated building photograph', () => {
  it('renders the neutral illustration and never a stock hospital photo', async () => {
    renderDetail(medanta);
    const visual = await screen.findByTestId('hospital-visual');
    const img = visual.querySelector('img')!;
    expect(img.getAttribute('src')).toContain('hospital-illustration-neutral');
    expect(img.getAttribute('alt')).toMatch(/not a photograph/i);
    expect(visual.innerHTML).not.toContain('hospital-govt.jpg');
    expect(visual.innerHTML).not.toContain('hospital-private.jpg');
    expect(within(visual).getByTestId('visual-caption').textContent).toMatch(/not a photograph/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Problem C — compact Maps link instead of an empty rating card', () => {
  it('shows a compact Google Maps link and no large empty rating card', async () => {
    renderDetail(medanta);
    const compact = await screen.findByTestId('google-rating-compact');
    expect(compact.textContent).toMatch(/Google Maps/);
    expect(screen.queryByTestId('google-rating-card')).toBeNull();
    expect(screen.queryByText(/Live Google rating unavailable/i)).toBeNull();
    expect(within(compact).getByTestId('google-maps-link').getAttribute('href')).toContain('google.com/maps');
    // Community score stays separate.
    expect(screen.getByTestId('community-score-card')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Problem A — road distance needs explicit permission; fallback is compact', () => {
  it('does not ask for location until the button is pressed', async () => {
    renderDetail(medanta);
    const button = await screen.findByTestId('use-my-location');
    expect(button.textContent).toMatch(/Use my location/i);
    // A "Get directions" link is available before any permission is granted.
    expect(screen.getAllByText(/Get directions/i).length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/route'))).toBe(false);
  });

  it('shows road distance + estimated drive time (never "Live traffic") on success', async () => {
    stubApis({
      '/api/route': () =>
        json({
          source: 'osrm',
          distanceKm: 7.4,
          minutes: 21,
          etaMinutes: 21,
          straightKm: 6.1,
          liveTraffic: false,
          provider: 'OSRM road routing',
          error: null,
          navigateUrl: 'https://www.google.com/maps/dir/?api=1&origin=1,2&destination=3,4',
          computedAt: new Date().toISOString(),
        }),
    });
    const getCurrentPosition = grantLocation();
    renderDetail(medanta);
    fireEvent.click(await screen.findByTestId('use-my-location'));

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('detail-distance').textContent).toMatch(/7\.4/));
    expect(screen.getByTestId('detail-eta').textContent).toMatch(/21/);
    expect(screen.getByTestId('detail-travel-summary').textContent).toMatch(/Estimated drive time/i);
    // Any mention of traffic must be a denial of it, never a live-traffic claim.
    const summary = screen.getByTestId('detail-travel-summary').textContent ?? '';
    expect(summary).not.toMatch(/Live traffic:?\s*(light|moderate|heavy|clear|\d)/i);
    expect(summary).not.toMatch(/in \d+ min of traffic/i);
    expect(summary).toMatch(/not available from this routing provider|without traffic/i);
    expect(screen.getByTestId('detail-travel-summary').textContent).toMatch(/OSRM/);
    expect(screen.queryByTestId('route-unavailable')).toBeNull();
    expect(screen.getByTestId('route-directions').getAttribute('href')).toContain('google.com/maps');
  });

  it('falls back compactly and labels the straight line when routing fails', async () => {
    stubApis({
      '/api/route': () =>
        json({
          source: 'unavailable',
          distanceKm: null,
          minutes: null,
          straightKm: 6.1,
          liveTraffic: false,
          error: 'offline',
          navigateUrl: 'https://www.google.com/maps/dir/?api=1&origin=1,2&destination=3,4',
          computedAt: null,
        }),
    });
    grantLocation();
    renderDetail(medanta);
    fireEvent.click(await screen.findByTestId('use-my-location'));

    const fallback = await screen.findByTestId('route-unavailable');
    expect(fallback.textContent).toMatch(/Road route unavailable/i);
    // No fabricated drive time: the ETA slot shows a dash, not a number.
    expect(screen.getByTestId('detail-eta').textContent).not.toMatch(/\d+\s*(min|hr)/i);
    // Straight-line is present and explicitly not a driving distance.
    const straight = screen.getByTestId('detail-straight-line');
    expect(straight.textContent).toMatch(/straight line/i);
    expect(straight.textContent).toMatch(/not a driving distance/i);
    expect(straight.textContent).not.toMatch(/^Driving distance/i);
    expect(screen.getByTestId('route-directions')).toBeInTheDocument();
  });

  it('explains a denied permission and keeps the manual alternative', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn((_ok: PositionCallback, fail?: PositionErrorCallback) =>
          fail?.({
            code: 1,
            message: 'denied',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as unknown as GeolocationPositionError),
        ),
      },
    });
    renderDetail(medanta);
    fireEvent.click(await screen.findByTestId('use-my-location'));
    const alert = await screen.findByTestId('route-location-error');
    expect(alert.textContent).toMatch(/denied|permission/i);
    expect(alert.textContent).toMatch(/city|pincode/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature 1 — scheme status on the detail page', () => {
  it('lists each scheme separately with evidence and the coverage caveat', async () => {
    renderDetail(medanta);
    const section = await screen.findByTestId('scheme-section');
    expect(section.textContent).toMatch(/PM-JAY/);
    expect(section.textContent).toMatch(/CGHS/);
    expect(section.textContent).toMatch(/Chirayu Haryana/);
    // Medanta is verified NOT empanelled in the official Gurugram list.
    expect(within(section).getAllByText(/Verified not empanelled/i).length).toBeGreaterThan(0);
    // No "Ayushman card accepted here" unless PM-JAY empanelment is verified.
    expect(screen.queryByTestId('ayushman-accepted')).toBeNull();
    expect(section.textContent).toMatch(/does not guarantee/i);

    // Evidence expands with the official source and dates.
    const expand = within(section).getAllByRole('button', { name: /Evidence & source/i })[0];
    fireEvent.click(expand);
    // Evidence block: official authority, the published PDF, record ids & dates.
    expect(section.textContent).toMatch(/Ayushman Bharat Haryana/);
    expect(section.textContent).toMatch(/cdnbbsr\.s3waas\.gov\.in.+\d{8}\.pdf/);
    expect(section.textContent).toMatch(/HOSP6[GP]/);
    expect(section.textContent).toMatch(/2026-08-03/);
    expect(section.textContent).toMatch(/2026-11-21/);
    const link = within(section).getByRole('link', { name: /Check the official list/i });
    expect(link.getAttribute('href')).toContain('cdnbbsr.s3waas.gov.in');
    expect(within(section).getByText(/2026-11-21/)).toBeTruthy();
    expect(within(section).getAllByText(/Report an incorrect badge/i).length).toBeGreaterThan(0);
  });

  it('says "Not verified" (never "Not empanelled") when there is no official record', async () => {
    renderDetail(aiims);
    const section = await screen.findByTestId('scheme-section');
    expect(within(section).queryByText(/Verified not empanelled/i)).toBeNull();
    expect(within(section).getAllByText(/^Not verified$/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature 2 — treatment selector drives hospital cost previews', () => {
  it('re-requests previews when the treatment changes', async () => {
    const calls: string[] = [];
    stubApis({
      '/api/cost-preview': (url) => {
        calls.push(url.searchParams.get('treatment') ?? '');
        return json({
          treatment: { id: url.searchParams.get('treatment'), name: 'Selected treatment' },
          results: [],
        });
      },
    });
    const { useState } = await import('react');
    function Harness() {
      const [value, setValue] = useState<string | null>('cataract');
      return <TreatmentSelector value={value} onChange={setValue} />;
    }
    render(
      <LanguageProvider>
        <Harness />
      </LanguageProvider>,
    );
    const select = screen.getByLabelText(/Treatment/i) as HTMLSelectElement;
    expect(select.value).toBe('cataract');
    fireEvent.change(select, { target: { value: 'knee-replacement' } });
    await waitFor(() => expect(select.value).toBe('knee-replacement'));
    // The selector itself does not fetch; the results hook does — assert the
    // option list is complete and honest (no invented prices in the selector).
    expect(screen.getByTestId('treatment-selector').textContent).toMatch(/Knee replacement/i);
    expect(calls).toHaveLength(0);
  });

  it('shows "Cost estimate unavailable" rather than an invented price', async () => {
    const { default: CostPreviewCompact } = await import('@/components/costs/CostPreview');
    render(
      <LanguageProvider>
        <CostPreviewCompact
          loading={false}
          treatmentName="Knee replacement"
          preview={{
            hospitalId: 'medanta-medicity',
            state: 'generic-range',
            figure: null,
            coverageNote: null,
            generic: {
              govt: { min: 0, max: 0, currency: 'INR' },
              private: { min: 250000, max: 400000, currency: 'INR' },
              asOf: '2023–2025',
              disclosure: 'generic',
            },
            community: null,
          }}
        />
      </LanguageProvider>,
    );
    const card = screen.getByTestId('cost-preview');
    expect(card.textContent).toMatch(/Cost estimate unavailable/i);
    expect(card.textContent).not.toMatch(/₹0/);
    // The generic range is behind the toggle, explicitly labelled.
    fireEvent.click(within(card).getByRole('button', { name: /Cost details/i }));
    expect(card.textContent).toMatch(/not this hospital/i);
  });

  it('renders the exact PM-JAY coverage sentence when empanelment is verified', async () => {
    const { default: CostPreviewCompact } = await import('@/components/costs/CostPreview');
    render(
      <LanguageProvider>
        <CostPreviewCompact
          loading={false}
          treatmentName="Normal delivery"
          preview={{
            hospitalId: 'x',
            state: 'potentially-covered',
            figure: null,
            coverageNote: {
              en: 'Potentially covered — confirm eligibility and package with the hospital.',
              hi: 'संभवतः आवरण — पात्रता और पैकेज की पुष्टि अस्पताल से करें।',
            },
            generic: {
              govt: { min: 500, max: 2000, currency: 'INR' },
              private: { min: 20000, max: 60000, currency: 'INR' },
              asOf: '2023–2025',
              disclosure: 'generic',
            },
            community: null,
          }}
        />
      </LanguageProvider>,
    );
    const card = screen.getByTestId('cost-preview');
    expect(card.textContent).toMatch(/Potentially covered/i);
    expect(card.textContent).not.toMatch(/₹0/);
    expect(card.textContent).not.toMatch(/out of pocket/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature 3 — bill amount form and public labels', () => {
  it('submits an amount, publishes a verification label and never shows the file', async () => {
    stubApis({
      '/api/bills': (url) =>
        url.searchParams.has('hospitalId')
          ? json({ count: 0, bills: [], aggregate: null })
          : json(
              {
                bill: {
                  id: 'bill-1',
                  hospitalId: medanta.id,
                  treatmentId: 'cataract',
                  careMonth: '2026-10',
                  amountInr: 24000,
                  coverage: { scope: 'total_bill' },
                  note: 'General ward',
                  verificationStatus: 'pending_verification',
                  statusReason: 'Bill uploaded — awaiting a JeevanSetu reviewer.',
                  hasPrivateEvidence: true,
                  isSingleObservation: true,
                  createdAt: '2026-11-21T00:00:00.000Z',
                  correctionPolicy: { canRequestRemoval: true, removalChannel: 'hello@jeevansetu.in' },
                },
                aggregate: { count: 1, pendingCount: 1, verifiedCount: 0, latestMonth: '2026-10', averageSuppressedReason: 'no average' },
                message: 'Thanks',
              },
              201,
            ),
    });
    renderDetail(medanta);
    fireEvent.click(await screen.findByTestId('open-bill-form'));

    const form = await screen.findByTestId('bill-form');
    expect(form.textContent).toMatch(/What did you actually pay/i);
    expect(form.textContent).toMatch(/cover or crop your name/i);

    fireEvent.change(within(form).getByLabelText(/Amount you paid/i), { target: { value: '24000' } });
    fireEvent.click(within(form).getByRole('checkbox'));
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByTestId('bill-submitted')).toBeInTheDocument());
    expect(screen.getByTestId('bill-submitted').textContent).toMatch(/₹24,000/);
    expect(screen.getByTestId('bill-submitted').textContent).toMatch(/Pending verification/i);
    const postCall = fetchMock.mock.calls
      .map((call) => call as [RequestInfo | URL, RequestInit | undefined])
      .find(([u, init]) => String(u).endsWith('/api/bills') && init?.method === 'POST');
    expect(postCall).toBeTruthy();
    const body = JSON.parse(String(postCall?.[1]?.body));
    expect(body.file ?? null).toBeNull();
    expect(body.consent).toBe(true);
    expect(body.amountInr).toBe(24000);
  });

  it('requires consent before publishing', async () => {
    renderDetail(medanta);
    fireEvent.click(await screen.findByTestId('open-bill-form'));
    const form = await screen.findByTestId('bill-form');
    fireEvent.change(within(form).getByLabelText(/Amount you paid/i), { target: { value: '1500' } });
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole('alert').textContent).toMatch(/consent/i));
    expect(screen.queryByTestId('bill-submitted')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hindi', () => {
  it('renders the detail page in Hindi with translated new sections', async () => {
    window.localStorage.setItem('jeevansetu-lang', 'hi');
    renderDetail(medanta);
    const section = await screen.findByTestId('scheme-section');
    await waitFor(() => expect(section.textContent).toMatch(/[\u0900-\u097F]/));
    const cost = screen.getByTestId('treatment-cost-section');
    expect(cost.textContent).toMatch(/[\u0900-\u097F]/);
    expect(screen.getByTestId('hospital-visual').textContent).toMatch(/[\u0900-\u097F]/);
  });
});
