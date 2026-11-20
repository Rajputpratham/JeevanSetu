import { cleanup, fireEvent, render, renderHook, screen, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DiscoveryClient from '@/components/hospitals/DiscoveryClient';
import { HOSPITALS } from '@/data/hospitals';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useHospitalDistances } from '@/hooks/useHospitalDistances';

const aiims = HOSPITALS.find((h) => h.id === 'aiims-new-delhi')!;
const safdarjung = HOSPITALS.find((h) => h.id === 'safdarjung-hospital')!;
const unlocated = { ...aiims, id: 'unlocated', shortName: 'Unknown Campus', name: 'Unknown Campus', lat: null, lng: null };
const delhi = { lat: 28.6139, lng: 77.209 };
const gurugram = { lat: 28.4595, lng: 77.0266 };
const table = (distances: (number | null)[], durations: (number | null)[]) => Response.json({ code: 'Ok', distances: [distances], durations: [durations] });
const finderKey = 'jeevansetu:finder-origin:v1';
const fetchMock = vi.fn<typeof fetch>();
const device = vi.fn<Geolocation['getCurrentPosition']>();
const requests = (needle: string) => fetchMock.mock.calls.filter(([input]) => String(input).includes(needle));
const card = (id: string) => within(document.getElementById(`hospital-card-${id}`)!);
const geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

beforeEach(() => {
  fetchMock.mockReset(); device.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('isSecureContext', true);
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState(null, '', '/hospitals?radius=500');
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: device } });
});
afterEach(() => {
  cleanup();
  if (geolocationDescriptor) Object.defineProperty(navigator, 'geolocation', geolocationDescriptor);
  else Reflect.deleteProperty(navigator, 'geolocation');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('renders no consent, denial, loading, road, straight-line and retry states without changing Directions', async () => {
  let resolveTable!: (value: Response) => void;
  fetchMock.mockImplementation(async (input) => {
    if (String(input).startsWith('/api/hospitals?')) return Response.json({ results: [safdarjung, unlocated, aiims] });
    if (requests('/table/').length === 1) return new Promise((resolve) => { resolveTable = resolve; });
    return table([0, 2400], [0, 480]);
  });
  render(<DiscoveryClient />);
  await screen.findByText(aiims.name);
  expect(device).not.toHaveBeenCalled();
  expect(requests('/table/')).toHaveLength(0);
  expect(card(unlocated.id).getByText('Location not available for this hospital.')).toBeVisible();
  const aiimsCard = card(aiims.id);
  expect(aiimsCard.getByText('Enable location to see distance')).toBeVisible();
  expect(aiimsCard.getByRole('link', { name: 'Directions' })).toHaveAttribute('href', expect.stringContaining('/maps/search/'));
  fireEvent.click(aiimsCard.getByRole('button', { name: 'Enable' }));
  expect(device).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
    enableHighAccuracy: false, timeout: 10000, maximumAge: 300000,
  });
  expect(aiimsCard.getByText('Getting your location…')).toBeVisible();
  act(() => { device.mock.calls[0][1]!({ code: 1 } as GeolocationPositionError); });
  expect(screen.getByRole('alert')).toHaveTextContent('Location blocked. Allow access in browser settings');
  expect(requests('/table/')).toHaveLength(0);
  fireEvent.click(aiimsCard.getByRole('button', { name: 'Retry location' }));
  act(() => { device.mock.calls[1][0]({ coords: { latitude: delhi.lat, longitude: delhi.lng } } as GeolocationPosition); });
  expect(aiimsCard.getByText('Calculating…')).toBeVisible();
  await waitFor(() => expect(requests('/table/')).toHaveLength(1));
  expect(String(requests('/table/')[0][0])).toMatch(/77\.209,28\.6139;77\.2075,28\.5664;77\.2089,28\.5671/);
  act(() => { resolveTable(table([0, null, 4200], [0, null, 900])); });
  expect(await aiimsCard.findByText('4.2 km · 15 min drive')).toBeVisible();
  expect(aiimsCard.getByText('Estimated driving route')).toBeVisible();
  expect(aiimsCard.getByRole('link', { name: 'Directions' })).toHaveAttribute('href', expect.stringContaining('origin=28.6139,77.209'));
  const fallbackCard = card(safdarjung.id);
  expect(fallbackCard.getByText(/approx\..*\(straight line\)/)).toBeVisible();
  expect([...document.querySelectorAll('article[id^="hospital-card-"]')].map((el) => el.id)).toEqual([
    `hospital-card-${aiims.id}`, `hospital-card-${safdarjung.id}`, `hospital-card-${unlocated.id}`,
  ]);
  fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name' } });
  expect(requests('/table/')).toHaveLength(1);
  expect(requests('/api/hospitals?')).toHaveLength(1);
  fireEvent.click(fallbackCard.getByRole('button', { name: 'Retry route' }));
  expect(await fallbackCard.findByText('2.4 km · 8 min drive')).toBeVisible();
  expect(requests('/table/')).toHaveLength(2);
  expect(String(requests('/table/')[1][0])).not.toContain('77.2089');
  expect(window.location.search).not.toContain('lat=');
  expect(localStorage.getItem(finderKey)).toBeNull();
  expect(JSON.parse(sessionStorage.getItem(finderKey)!)).toMatchObject({ ...delhi, method: 'device' });
});

it('only geocodes on submit and only routes from an explicitly selected match', async () => {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith('/api/hospitals?')) return Response.json({ results: [aiims] });
    if (url === '/api/geocode/finder') return Response.json({ results: [
      { ...gurugram, label: 'Gurugram, Haryana' }, { ...delhi, label: 'Another match' },
    ] });
    return table([0, 13000], [0, 1900]);
  });
  render(<DiscoveryClient />);
  await screen.findByText(aiims.name);
  fireEvent.change(screen.getByLabelText('Or enter a city or pincode'), { target: { value: 'Gurugram' } });
  expect(requests('/api/geocode/')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByText('Multiple matches. Choose the correct starting point.')).toBeVisible();
  expect(requests('/table/')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Gurugram, Haryana' }));
  expect(await screen.findByText('13.0 km · 32 min drive')).toBeVisible();
  expect(String(requests('/table/')[0][0])).toContain('/77.0266,28.4595;');
  expect(device).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear location' }));
  expect(card(aiims.id).getByText('Enable location to see distance')).toBeVisible();
  expect(sessionStorage.getItem(finderKey)).toBeNull();
});

it('validates session storage and restores only the consented origin, without polling the device', () => {
  sessionStorage.setItem(finderKey, JSON.stringify({ lat: 88, lng: 181, method: 'manual', label: 'Invalid' }));
  const invalid = renderHook(useUserLocation);
  expect(invalid.result.current.location).toBeNull();
  invalid.unmount();
  sessionStorage.setItem(finderKey, JSON.stringify({ ...delhi, method: 'manual', label: 'Delhi' }));
  const valid = renderHook(useUserLocation);
  expect(valid.result.current.location).toEqual({ ...delhi, method: 'manual', label: 'Delhi' });
  expect(device).not.toHaveBeenCalled();
});

it('discards stale responses when the origin and filtered list change', async () => {
  vi.useFakeTimers();
  const firstHospital = [{ id: 'stale-first', lat: 28.5671, lng: 77.2089 }];
  const currentHospital = [{ id: 'stale-current', lat: 28.5664, lng: 77.2075 }];
  let resolveOld!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  fetchMock.mockResolvedValueOnce(table([0, 8500], [0, 900]));
  const { result, rerender } = renderHook(({ origin, list }) => useHospitalDistances(origin, list), {
    initialProps: { origin: delhi, list: firstHospital },
  });
  await act(() => vi.advanceTimersByTimeAsync(299));
  expect(fetchMock).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(1));
  rerender({ origin: gurugram, list: currentHospital });
  await act(() => vi.advanceTimersByTimeAsync(300));
  expect(result.current.distances.get('stale-current')?.km).toBe(8.5);
  await act(async () => { resolveOld(table([0, 4200], [0, 900])); });
  expect(result.current.distances.get('stale-current')?.km).toBe(8.5);
  expect(result.current.distances.has('stale-first')).toBe(false);
});
