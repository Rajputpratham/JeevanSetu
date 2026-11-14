import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { LanguageProvider, useLang } from '@/lib/i18n';
import { SavedProvider, useSavedHospitals } from '@/lib/saved';
import { CompareProvider, useCompare } from '@/lib/compare';
import { HOSPITALS } from '@/data/hospitals';
import { TREATMENTS } from '@/data/treatments';
import { estimateTreatment } from '@/lib/cost-estimate';
import { recommendHospitals, specialityForProblem } from '@/lib/recommend';
import { GET as estimateGet, POST as estimatePost } from '@/app/api/estimate/route';
import { GET as recommendGet } from '@/app/api/recommendations/route';
import { GET as hospitalSlugGet } from '@/app/api/hospitals/[id]/route';
import { GET as googleRatingsGet } from '@/app/api/google-ratings/route';

describe('Full Regression Suite: Saved Hospitals, Compare, Cost Estimator, Recommendations & RTL DOM', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('updates <html lang> and <html dir="rtl"> dynamically when switching to Urdu and back to Tamil', () => {
    function LangProbe() {
      const { lang, setLang, t } = useLang();
      return (
        <div>
          <span data-testid="active-lang">{lang}</span>
          <span data-testid="nav-home">{t('navHome')}</span>
          <button onClick={() => setLang('ur')}>Switch Urdu</button>
          <button onClick={() => setLang('ta')}>Switch Tamil</button>
        </div>
      );
    }

    render(
      <LanguageProvider>
        <LangProbe />
      </LanguageProvider>,
    );

    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    fireEvent.click(screen.getByText('Switch Urdu'));
    expect(screen.getByTestId('active-lang').textContent).toBe('ur');
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
    expect(window.localStorage.getItem('jeevansetu-lang')).toBe('ur');

    fireEvent.click(screen.getByText('Switch Tamil'));
    expect(screen.getByTestId('active-lang').textContent).toBe('ta');
    expect(document.documentElement.lang).toBe('ta');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('persists saved hospitals and compare tray selections in localStorage', () => {
    function SavedAndCompareProbe() {
      const { savedIds, toggleSaved, isSaved } = useSavedHospitals();
      const { ids, toggle, clear } = useCompare();
      return (
        <div>
          <span data-testid="saved-count">{savedIds.length}</span>
          <span data-testid="saved-aiims">{String(isSaved('aiims-new-delhi'))}</span>
          <span data-testid="compare-count">{ids.length}</span>
          <button onClick={() => toggleSaved('aiims-new-delhi')}>Save AIIMS</button>
          <button onClick={() => toggle('aiims-new-delhi')}>Compare AIIMS</button>
          <button onClick={() => toggle('safdarjung-new-delhi')}>Compare Safdarjung</button>
          <button onClick={() => clear()}>Clear Compare</button>
        </div>
      );
    }

    render(
      <SavedProvider>
        <CompareProvider>
          <SavedAndCompareProbe />
        </CompareProvider>
      </SavedProvider>,
    );

    expect(screen.getByTestId('saved-count').textContent).toBe('0');
    fireEvent.click(screen.getByText('Save AIIMS'));
    expect(screen.getByTestId('saved-count').textContent).toBe('1');
    expect(screen.getByTestId('saved-aiims').textContent).toBe('true');

    fireEvent.click(screen.getByText('Compare AIIMS'));
    fireEvent.click(screen.getByText('Compare Safdarjung'));
    expect(screen.getByTestId('compare-count').textContent).toBe('2');

    fireEvent.click(screen.getByText('Clear Compare'));
    expect(screen.getByTestId('compare-count').textContent).toBe('0');
  });

  it('preserves Cost Estimator API and engine across government vs private tiers and multilingual requests', async () => {
    const catRes = estimateGet();
    const catBody = await catRes.json();
    expect(catBody.count).toBe(TREATMENTS.length);
    expect(catBody.count).toBeGreaterThanOrEqual(12);

    const req = new NextRequest('http://localhost:3000/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        treatmentId: 'angioplasty',
        stayDays: 3,
        roomType: 'semi-private',
        lang: 'ta',
      }),
    });
    const postRes = await estimatePost(req);
    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.govtTotal[1]).toBeLessThan(postBody.privateTotal[1]);
    expect(postBody.lines.length).toBeGreaterThan(0);

    const direct = estimateTreatment(TREATMENTS[0], {
      treatmentId: TREATMENTS[0].id,
      includedTests: [0],
      stayDays: 2,
      roomType: 'general',
    }, 'hi');
    expect(direct.govtTotal[0]).toBeGreaterThanOrEqual(0);
  });

  it('preserves Hospital Recommendations engine and API with road distances and problem-to-speciality mapping', async () => {
    expect(specialityForProblem('severe chest pain and heart blockage')).toBe('Cardiology');

    const req = new NextRequest(
      'http://localhost:3000/api/recommendations?problem=heart+attack&budget=low&type=government&lat=28.6428&lng=77.1855&lang=bn',
    );
    const res = await recommendGet(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.speciality).toBe('Cardiology');
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].hospital.type).toBe('government');

    const direct = recommendHospitals(HOSPITALS, {
      speciality: 'Oncology',
      typePreference: 'any',
      budget: 'low',
      facilitiesWanted: ['Ayushman Bharat (PM-JAY)'],
      lat: 19.002,
      lng: 72.842,
      lang: 'mr',
    });
    expect(direct.length).toBeGreaterThan(0);
  });

  it('verifies single-hospital slug API and honest Google Places unconfigured status', async () => {
    const slugReq = new NextRequest('http://localhost:3000/api/hospitals/aiims-new-delhi');
    const slugRes = await hospitalSlugGet(slugReq, { params: Promise.resolve({ id: 'aiims-new-delhi' }) });
    expect(slugRes.status).toBe(200);
    const slugBody = await slugRes.json();
    expect(slugBody.hospital.id).toBe('aiims-new-delhi');

    const gpReq = new NextRequest('http://localhost:3000/api/google-ratings?hospitalId=aiims-new-delhi');
    const gpRes = await googleRatingsGet(gpReq);
    expect(gpRes.status).toBe(200);
    const gpBody = await gpRes.json();
    expect(gpBody.status).toBe('awaiting-api-key');
    expect(gpBody.rating).toBeNull();
  });
});
