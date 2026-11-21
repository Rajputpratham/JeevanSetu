// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import { SCHEME_EMPANELMENT } from '@/data/scheme-empanelment';
import { SCHEME_STATUS_LABELS } from '@/data/schemes';
import { resolveScheme, resolveRecord, resolveAllSchemes, ayushmanAccepted, schemeBadges, relevantSchemes } from '@/lib/schemes';
import { buildCostPreview, resolveTreatment, COVERAGE_ACKNOWLEDGEMENT } from '@/lib/hospital-costs';
import { TREATMENTS } from '@/data/treatments';
import { HOSPITAL_COSTS } from '@/data/hospital-costs';
import { photoFor, HOSPITAL_PHOTOS, NEUTRAL_ILLUSTRATION } from '@/data/hospital-images';
import { clearTravelCache } from '@/lib/travel-cache';
import {
  addBill,
  aggregateFor,
  getPrivateRecord,
  getPublicBills,
  publicView,
  removeBill,
  resetBillStore,
  reviewBill,
  validateBillInput,
} from '@/lib/review-bills';
import { dict } from '@/lib/i18n';

const HOSPITAL_IDS = new Set(HOSPITALS.map((h) => h.id));
const TREATMENT_IDS = new Set(TREATMENTS.map((t) => t.id));

beforeEach(() => {
  resetBillStore();
  clearTravelCache();
  for (const key of ['GOOGLE_MAPS_API_KEY', 'GOOGLE_PLACES_API_KEY', 'OSRM_BASE_URL', 'OSRM_ACCESS_TOKEN', 'BILL_REVIEW_TOKEN']) {
    vi.stubEnv(key, '');
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1 — scheme empanelment
// ─────────────────────────────────────────────────────────────────────────────
describe('scheme empanelment', () => {
  it('labels an unknown branch/scheme “Not verified”, never “not empanelled”', () => {
    const aiims = getHospitalById('aiims-new-delhi')!;
    const pmjay = resolveScheme(aiims.id, 'pmjay');
    expect(pmjay.record).toBeNull();
    expect(pmjay.status).toBe('unverified');
    expect(pmjay.label).toBe('Not verified');
    expect(pmjay.label).not.toBe(SCHEME_STATUS_LABELS.verified_not_empanelled.en);
    expect(ayushmanAccepted(aiims)).toBe(false);
  });

  it('every scheme record points at a real hospital branch and carries provenance', () => {
    for (const record of SCHEME_EMPANELMENT) {
      expect(HOSPITAL_IDS.has(record.hospitalId)).toBe(true);
      expect(record.sourceUrl).toMatch(/^https:\/\//);
      expect(record.authority.length).toBeGreaterThan(5);
      expect(record.lastCheckedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(record.evidenceNote.length).toBeGreaterThan(30);
      expect(record.matchConfidence).toBe('exact-branch');
    }
  });

  it('keeps a group/brand listing from leaking onto every branch', () => {
    // Fortis Gurugram has a decisive official record; other Fortis/Max/Apollo
    // branches in the dataset have none and must stay unverified.
    expect(resolveScheme('fmri-gurugram', 'pmjay').status).toBe('verified_not_empanelled');
    for (const id of ['max-saket', 'blk-max-pusa', 'apollo-indraprastha', 'fortis-escorts-okhla', 'fortis-vasant-kunj']) {
      expect(resolveScheme(id, 'pmjay').status).toBe('unverified');
    }
  });

  it('downgrades stale and unclear evidence to “Not verified”', () => {
    const now = Date.parse('2030-01-01T00:00:00Z'); // > 1 year after every record
    const stale = resolveScheme('medanta-medicity', 'pmjay', { now });
    expect(stale.stale).toBe(true);
    expect(stale.status).toBe('unverified');

    const fresh = resolveScheme('medanta-medicity', 'pmjay', { now: Date.parse('2026-11-22T00:00:00Z') });
    expect(fresh.status).toBe('verified_not_empanelled');
  });

  it('never lets “Ayushman card accepted” appear without a fresh verified PM-JAY record', () => {
    for (const hospital of HOSPITALS) {
      const pmjay = resolveScheme(hospital.id, 'pmjay');
      expect(ayushmanAccepted(hospital)).toBe(pmjay.status === 'verified_empanelled' && !pmjay.stale);
    }
    expect(ayushmanAccepted(getHospitalById('aiims-bhubaneswar')!)).toBe(false);
  });

  it('shows only state-relevant schemes, each separately, with Hindi labels', () => {
    const delhi = getHospitalById('aiims-new-delhi')!;
    expect(relevantSchemes(delhi)).toEqual(['pmjay', 'cghs', 'delhi-arogya-kosh']);
    const haryana = getHospitalById('medanta-medicity')!;
    expect(relevantSchemes(haryana)).toEqual(['pmjay', 'cghs', 'haryana-chirayu']);

    const badges = schemeBadges(haryana, { lang: 'hi' });
    expect(badges.map((b) => b.short)).toEqual(['PM-JAY', 'CGHS', 'Chirayu Haryana']);
    expect(badges[0].label).toContain('आयुष्मान');
    expect(badges[0].status).toBe('verified_not_empanelled');
    expect(resolveAllSchemes(haryana, { lang: 'hi' })[0].label).toBe('सत्यापित — सूची में नहीं');
  });

  it('exposes provenance through /api/schemes for a card payload', async () => {
    const { GET } = await import('@/app/api/schemes/route');
    const res = GET(new NextRequest('http://localhost:3000/api/schemes?ids=fmri-gurugram&lang=en'));
    const data = await res.json();
    const pmjay = data.results[0].schemes.find((s: { scheme: string }) => s.scheme === 'pmjay');
    expect(pmjay.status).toBe('verified_not_empanelled');
    // The state portal publishes the district list as a PDF on its own CDN.
    expect(pmjay.sourceUrl).toMatch(/^https:\/\/cdnbbsr\.s3waas\.gov\.in\/.*\.pdf$/);
    expect(pmjay.authority).toMatch(/Ayushman Bharat Haryana/);
    expect(pmjay.lastCheckedOn).toBe('2026-11-21');
    expect(data.results[0].disclosure).toMatch(/does not guarantee/i);
    expect(data.reportBadgeUrl).toContain('mailto:');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2 — treatment × hospital cost preview
// ─────────────────────────────────────────────────────────────────────────────
describe('treatment cost preview', () => {
  it('resolves aliases and rejects unknown treatments', () => {
    expect(resolveTreatment('c-section')?.id).toBe('caesarean');
    expect(resolveTreatment('Dialysis')?.id).toBe('dialysis-session');
    expect(resolveTreatment('normal-delivery')?.id).toBe('normal-delivery');
    expect(resolveTreatment('not-a-treatment')).toBeNull();
    expect(resolveTreatment('')).toBeNull();
  });

  it('holds no invented hospital price and never claims ₹0', () => {
    expect(HOSPITAL_COSTS).toEqual([]);
    for (const hospital of HOSPITALS) {
      for (const treatment of TREATMENTS) {
        const preview = buildCostPreview(hospital, treatment);
        expect(preview.figure).toBeNull();
        expect(preview.state).toBe('generic-range');
        expect(JSON.stringify(preview)).not.toContain('"0"');
        expect(preview.generic.disclosure).toMatch(/not this hospital/i);
      }
    }
  });

  it('turns empanelment alone into the exact “Potentially covered” sentence, not a payment claim', async () => {
    const { buildCostPreviewWithSchemes } = await import('@/lib/hospital-costs');
    const hospital = getHospitalById('medanta-medicity')!;
    const delivery = resolveTreatment('normal-delivery')!;
    const empanelled = resolveRecord(
      {
        hospitalId: hospital.id,
        scheme: 'pmjay',
        status: 'verified_empanelled',
        authority: 'National Health Authority (NHA)',
        sourceUrl: 'https://hospitals.pmjay.gov.in/',
        officialRecordId: 'TEST-ONLY',
        effectiveOn: '2026-01-01',
        lastCheckedOn: '2026-11-01',
        validityNote: null,
        matchConfidence: 'exact-branch',
        evidenceNote: 'Synthetic record supplied by the test only.',
      },
      'pmjay',
    );
    expect(empanelled.status).toBe('verified_empanelled');

    const preview = buildCostPreviewWithSchemes(hospital, delivery, [empanelled]);
    expect(preview.state).toBe('potentially-covered');
    expect(preview.figure).toBeNull();
    expect(preview.coverageNote?.en).toBe(COVERAGE_ACKNOWLEDGEMENT.en);
    expect(JSON.stringify(preview)).not.toMatch(/₹\s?0|out of pocket/i);

    // Shipped data path: no verified hospital figure anywhere.
    const real = buildCostPreview(hospital, delivery);
    expect(real.figure).toBeNull();
    expect(real.state).toBe('generic-range');
  });

  it('does not attach an inpatient coverage note to OPD-only care', () => {
    const opd = resolveTreatment('cbc-test')!;
    expect(opd.roomPerDay).toBeNull();
    const preview = buildCostPreview(getHospitalById('aiims-new-delhi')!, opd);
    expect(preview.coverageNote).toBeNull();
  });

  it('keeps community observations separate from any price', () => {
    const treatment = resolveTreatment('cataract')!;
    const hospital = getHospitalById('aiims-new-delhi')!;
    addBill({
      hospitalId: hospital.id,
      treatmentId: treatment.id,
      careMonth: '2026-09',
      amountInr: 18000,
      coverage: { scope: 'total_bill' },
      consentGiven: true,
    });
    const aggregate = aggregateFor(hospital.id, treatment.id);
    const preview = buildCostPreview(hospital, treatment, { community: { count: aggregate.count, latestMonth: aggregate.latestMonth } });
    expect(preview.figure).toBeNull();
    expect(preview.community?.count).toBe(1);
    expect(preview.community?.label).toMatch(/not a hospital tariff or a typical price/i);
  });

  it('serves a batched preview endpoint that updates with treatment and rejects unknown ids', async () => {
    const { GET } = await import('@/app/api/cost-preview/route');
    const ids = 'aiims-new-delhi,medanta-medicity';
    const a = await (await GET(new NextRequest(`http://localhost:3000/api/cost-preview?treatment=cataract&ids=${ids}&lang=en`))).json();
    const b = await (await GET(new NextRequest(`http://localhost:3000/api/cost-preview?treatment=knee-replacement&ids=${ids}&lang=en`))).json();
    expect(a.treatment.id).toBe('cataract');
    expect(b.treatment.id).toBe('knee-replacement');
    expect(a.results[0].generic).not.toEqual(b.results[0].generic);
    expect(a.results).toHaveLength(2);

    const bad = await GET(new NextRequest('http://localhost:3000/api/cost-preview?treatment=nope&ids=aiims-new-delhi'));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('UNKNOWN_TREATMENT');

    const hi = await (await GET(new NextRequest(`http://localhost:3000/api/cost-preview?treatment=cataract&ids=aiims-new-delhi&lang=hi`))).json();
    expect(hi.treatment.name).toMatch(/[\u0900-\u097F]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3 — bill amounts, verification states, privacy
// ─────────────────────────────────────────────────────────────────────────────
describe('community bill amounts', () => {
  const base = {
    hospitalId: 'aiims-new-delhi',
    treatmentId: 'cataract',
    careMonth: '2026-10',
    amountInr: 24000,
    coverage: { scope: 'total_bill' as const },
    consentGiven: true,
  };

  it('validates consent, amount, month, treatment and file type', () => {
    expect(validateBillInput({ ...base, consentGiven: false }, HOSPITAL_IDS, TREATMENT_IDS)?.code).toBe('CONSENT_REQUIRED');
    expect(validateBillInput({ ...base, amountInr: 0 }, HOSPITAL_IDS, TREATMENT_IDS)?.code).toBe('BAD_AMOUNT');
    expect(validateBillInput({ ...base, amountInr: 2.5 }, HOSPITAL_IDS, TREATMENT_IDS)?.code).toBe('BAD_AMOUNT');
    expect(validateBillInput({ ...base, careMonth: '2026-13' }, HOSPITAL_IDS, TREATMENT_IDS)?.code).toBe('BAD_MONTH');
    expect(validateBillInput({ ...base, treatmentId: 'x' }, HOSPITAL_IDS, TREATMENT_IDS)?.code).toBe('UNKNOWN_TREATMENT');
    expect(validateBillInput({ ...base, hospitalId: 'x' }, HOSPITAL_IDS, TREATMENT_IDS)?.code).toBe('UNKNOWN_HOSPITAL');
    expect(
      validateBillInput(
        { ...base, file: { originalName: 'a.exe', mimeType: 'application/x-msdownload', base64: 'AAAA' } },
        HOSPITAL_IDS,
        TREATMENT_IDS,
      )?.code,
    ).toBe('BAD_FILE_TYPE');
  });

  it('starts as self-reported without evidence and pending with evidence', () => {
    const plain = addBill(base);
    expect(plain.ok && plain.record.verificationStatus).toBe('self_reported');

    const withFile = addBill({
      ...base,
      careMonth: '2026-09',
      file: { originalName: 'bill.pdf', mimeType: 'application/pdf', base64: 'JVBERi0xLjQK' },
    });
    expect(withFile.ok && withFile.record.verificationStatus).toBe('pending_verification');
    expect(withFile.ok && withFile.record.hasPrivateEvidence).toBe(true);
  });

  it('never exposes the uploaded file, its name or contact details publicly', () => {
    const added = addBill({
      ...base,
      note: 'Call me on 9876543210 or mail me@example.com, patient ID 1234 5678 9012',
      file: { originalName: 'secret-bill.pdf', mimeType: 'application/pdf', base64: 'JVBERi0xLjQK' },
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const serialized = JSON.stringify(added.record);
    expect(serialized).not.toContain('JVBERi0xLjQK');
    expect(serialized).not.toContain('secret-bill.pdf');
    expect(serialized).not.toContain('9876543210');
    expect(serialized).not.toContain('me@example.com');
    expect(serialized).not.toContain('1234 5678 9012');
    expect(added.record.note).toContain('[phone redacted]');
    // The private store still holds the file for reviewers.
    expect(getPrivateRecord(added.record.id)?.file?.base64).toBe('JVBERi0xLjQK');
  });

  it('only reaches “Bill verified” after an explicit evidence check', () => {
    const added = addBill({
      ...base,
      file: { originalName: 'bill.png', mimeType: 'image/png', base64: 'iVBORw0KGgo=' },
    });
    if (!added.ok) throw new Error('expected bill');
    const id = added.record.id;

    const softApprove = reviewBill(id, 'approve', 'Looks fine', false);
    expect(softApprove?.verificationStatus).toBe('pending_verification');

    const verified = reviewBill(id, 'approve', 'Matched uploaded bill', true);
    expect(verified?.verificationStatus).toBe('bill_verified');
    expect(getPublicBills({ hospitalId: base.hospitalId })[0].verificationStatus).toBe('bill_verified');

    const rejected = reviewBill(id, 'reject', 'Amount does not match the bill', false);
    expect(rejected?.verificationStatus).toBe('rejected_removed');
    expect(getPublicBills({ hospitalId: base.hospitalId })).toHaveLength(0);
    expect(getPublicBills({ hospitalId: base.hospitalId })).not.toContainEqual(
      expect.objectContaining({ id }),
    );
  });

  it('supports reporter-requested deletion and duplicate protection', () => {
    const added = addBill(base);
    if (!added.ok) throw new Error('expected bill');
    expect(removeBill(added.record.id)).toBe(true);
    expect(getPrivateRecord(added.record.id)?.verificationStatus).toBe('rejected_removed');

    const again = addBill(base);
    const third = addBill(base);
    expect(again.ok).toBe(true);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.error.code).toBe('DUPLICATE');
  });

  it('never computes an average or a “typical price” from observations', () => {
    addBill(base);
    addBill({ ...base, careMonth: '2026-08', amountInr: 31000 });
    const aggregate = aggregateFor(base.hospitalId, base.treatmentId);
    expect(aggregate.count).toBe(2);
    expect(aggregate).not.toHaveProperty('average');
    expect(aggregate).not.toHaveProperty('median');
    expect(aggregate.averageSuppressedReason).toMatch(/no average/i);
  });

  it('public list is aggregate-only and omits rejected records', () => {
    addBill(base);
    const visible = getPublicBills({ hospitalId: base.hospitalId });
    expect(visible[0].isSingleObservation).toBe(true);
    expect(visible[0].correctionPolicy.canRequestRemoval).toBe(true);
    expect(Object.keys(visible[0])).not.toContain('file');
    expect(publicView).toBeTypeOf('function');
  });

  it('POST /api/bills publishes a label but never the file; PATCH needs the review token', async () => {
    const { POST, GET, PATCH } = await import('@/app/api/bills/route');
    const post = await POST(
      new NextRequest('http://localhost:3000/api/bills', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.7' },
        body: JSON.stringify({
          hospitalId: base.hospitalId,
          treatmentId: base.treatmentId,
          careMonth: base.careMonth,
          amountInr: base.amountInr,
          scope: 'total_bill',
          consent: true,
          note: 'General ward, 2 nights',
          file: { name: 'bill.jpg', mimeType: 'image/jpeg', base64: '/9j/4AAQSkZJRg==' },
        }),
      }),
    );
    expect(post.status).toBe(201);
    const posted = await post.json();
    expect(posted.bill.verificationStatus).toBe('pending_verification');
    expect(JSON.stringify(posted)).not.toContain('/9j/4AAQSkZJRg==');

    const get = await GET(new NextRequest(`http://localhost:3000/api/bills?hospitalId=${base.hospitalId}`));
    const listed = await get.json();
    expect(listed.bills[0].verificationStatus).toBe('pending_verification');
    expect(JSON.stringify(listed)).not.toContain('/9j/4AAQSkZJRg==');
    expect(listed.disclosure).toMatch(/not the hospital’s tariff/i);

    const unauthorised = await PATCH(
      new NextRequest('http://localhost:3000/api/bills', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: posted.bill.id, decision: 'approve', verifiedAgainstFile: true }),
      }),
    );
    expect(unauthorised.status).toBe(401);
    // Still not verified after the rejected attempt.
    expect(getPublicBills({ hospitalId: base.hospitalId })[0].verificationStatus).toBe('pending_verification');
  });

  it('rejects a submission without consent', async () => {
    const { POST } = await import('@/app/api/bills/route');
    const res = await POST(
      new NextRequest('http://localhost:3000/api/bills', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.8' },
        body: JSON.stringify({
          hospitalId: base.hospitalId,
          treatmentId: base.treatmentId,
          careMonth: base.careMonth,
          amountInr: 100,
          scope: 'total_bill',
          consent: false,
        }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('CONSENT_REQUIRED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Problems A/B/C — route fallback, image provenance, Google rating compaction
// ─────────────────────────────────────────────────────────────────────────────
describe('Problem A — road route with and without a provider', () => {
  it('falls back honestly and keeps a working directions link when OSRM fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { GET } = await import('@/app/api/route/route');
    const res = await GET(
      new NextRequest('http://localhost:3000/api/route?fromLat=28.6139&fromLng=77.209&hospitalId=aiims-new-delhi'),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.source).toBe('unavailable');
    expect(data.distanceKm).toBeNull();
    expect(data.minutes).toBeNull();
    expect(data.etaMinutes).toBeNull();
    expect(data.liveTraffic).toBe(false);
    expect(data.straightKm).toBeGreaterThan(1);
    expect(data.navigateUrl).toContain('google.com/maps/dir');
    expect(data.error).toBeTruthy();
  });

  it('returns a routed road distance + estimated drive time from OSRM, never live traffic', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 'Ok', routes: [{ distance: 5234, duration: 912, geometry: { coordinates: [[77.209, 28.6139], [77.2089, 28.5671]] } }] }),
      ),
    );
    const { GET } = await import('@/app/api/route/route');
    const data = await (await GET(
      new NextRequest('http://localhost:3000/api/route?fromLat=28.6139&fromLng=77.209&hospitalId=aiims-new-delhi'),
    )).json();
    expect(data.source).toBe('osrm');
    expect(data.distanceKm).toBe(5.2);
    expect(data.minutes).toBe(15);
    expect(data.liveTraffic).toBe(false);
    expect(data.provider).toMatch(/OSRM/);
    expect(data.disclosure.live).toBe(false);
    expect(data.geometry[0]).toEqual([28.6139, 77.209]);
    const calledUrl = String((fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(calledUrl).toContain('/route/v1/driving/');
    expect(calledUrl).toContain('overview=full');
  });

  it('rejects invalid origins and unknown hospitals instead of guessing', async () => {
    const { GET } = await import('@/app/api/route/route');
    const bad = await GET(new NextRequest('http://localhost:3000/api/route?fromLat=abc&fromLng=77.1&hospitalId=aiims-new-delhi'));
    expect(bad.status).toBe(400);
    const unknown = await GET(new NextRequest('http://localhost:3000/api/route?fromLat=28.6&fromLng=77.2&hospitalId=nope'));
    expect(unknown.status).toBe(404);
  });
});

describe('Problem B — image provenance', () => {
  it('has no stock "representative" photographs and no verified branch photos yet', () => {
    expect(Object.keys(HOSPITAL_PHOTOS)).toHaveLength(0);
    for (const hospital of HOSPITALS) {
      expect(photoFor(hospital.id)).toBeNull();
    }
    expect(NEUTRAL_ILLUSTRATION.src).toContain('illustration');
  });

  it('refuses a photo keyed to a different branch', () => {
    // Simulate a mistakenly duplicated record: key ≠ branchId must not render.
    const target = 'aiims-new-delhi';
    const original = HOSPITAL_PHOTOS[target];
    HOSPITAL_PHOTOS[target] = {
      src: '/images/x.jpg',
      alt: 'x',
      width: 1,
      height: 1,
      depicts: 'x',
      branchId: 'safdarjung-hospital',
      rights: { kind: 'own-work', licence: 'test' },
      sourceUrl: 'https://example.com',
      verifiedOn: '2026-11-21',
    };
    expect(photoFor(target)).toBeNull();
    if (original) HOSPITAL_PHOTOS[target] = original;
    else delete HOSPITAL_PHOTOS[target];
  });
});

describe('Problem C — Google rating presentation', () => {
  it('reports an explicit non-connected status when no Places key exists', async () => {
    const { GET } = await import('@/app/api/google-ratings/route');
    const data = await (await GET(new NextRequest('http://localhost:3000/api/google-ratings?hospitalId=aiims-new-delhi'))).json();
    expect(data.status).not.toBe('connected');
    expect(data.rating).toBeNull();
    expect(data.googleMapsUrl).toContain('google.com/maps');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Translations
// ─────────────────────────────────────────────────────────────────────────────
describe('new strings exist in English and Hindi', () => {
  const required = [
    'schemesTitle',
    'schemeStatusVerifiedEmpanelled',
    'schemeStatusVerifiedNot',
    'schemeStatusUnverified',
    'schemeAyushmanAccepted',
    'schemeNotGuarantee',
    'costPreviewTitle',
    'costPreviewGenericRange',
    'costPreviewUnavailable',
    'costPreviewPotentiallyCovered',
    'costPreviewNoneForBranch',
    'billFormTitle',
    'billAmountLabel',
    'billStatusSelfReported',
    'billStatusPending',
    'billStatusVerified',
    'billStatusRejected',
    'billUploadHint',
    'billConsentLabel',
    'imageIllustrationCaption',
    'imageIllustrationAlt',
    'googleRatingCompactBody',
    'roadRouteUnavailable',
    'estimatedDriveTime',
    'useMyLocationCta',
    'estimatorFindHospitalsCta',
  ] as const;

  it('translates every new key into Hindi (not English fallback)', () => {
    for (const key of required) {
      expect(dict.en[key]).toBeTruthy();
      expect(dict.hi[key]).toBeTruthy();
      expect(dict.hi[key]).not.toBe(dict.en[key]);
    }
  });
});
