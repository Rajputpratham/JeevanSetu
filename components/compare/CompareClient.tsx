'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, X, Plus, Trash2, Printer, LocateFixed, Navigation, PhoneCall,
  Check, Minus, Info, GitCompareArrows, Trophy, Star, Clock, MapPin, Loader2,
} from 'lucide-react';
import { useCompare, MAX_COMPARE } from '@/lib/compare';
import { useUserLocation, CITY_PRESETS } from '@/lib/useLocation';
import { HOSPITALS } from '@/data/hospitals';
import { TREATMENTS } from '@/data/treatments';
import { estimateTravelMetrics, formatDistance, formatDuration, directionsUrl } from '@/lib/geo';
import { estimateTreatment } from '@/lib/cost-estimate';
import { formatRange } from '@/lib/format';
import { Hospital } from '@/data/types';
import { useLang, DictKey } from '@/lib/i18n';
import {
  CITY_HI, FACILITY_HI, SPECIALITY_HI, STATE_HI,
  tCity, tFacility, tHospitalMeta, tPresetLabel, tSpeciality, tState,
} from '@/lib/i18n-data';
import type { CommunityScoreSummary } from '@/lib/ratings';

const KEY_FACILITIES = [
  'Emergency 24×7',
  'ICU',
  'Dialysis',
  'Maternity & Delivery',
  'Blood Bank',
  'CT Scan',
  'MRI',
  'Ambulance',
  'Diagnostic Lab',
  'Operation Theatre',
];

const PROFILE_KEY: Record<Hospital['costProfile'], DictKey> = {
  'very-low': 'costProfileVeryLow',
  low: 'costProfileLow',
  moderate: 'costProfileModerate',
  high: 'costProfileHigh',
};

export default function CompareClient() {
  const { t, lang } = useLang();
  const { ids, add, remove, clear, full } = useCompare();
  const { location, setManual, requestGeolocation, status: geoStatus } = useUserLocation();
  const [query, setQuery] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [notice, setNotice] = useState(false);
  const [originInput, setOriginInput] = useState('');
  const [originBusy, setOriginBusy] = useState(false);
  const [communityMap, setCommunityMap] = useState<Record<string, CommunityScoreSummary>>({});

  const selected = useMemo(
    () => ids.map((id) => HOSPITALS.find((h) => h.id === id)).filter((h): h is Hospital => !!h),
    [ids],
  );
  const treatment = treatmentId ? TREATMENTS.find((tr) => tr.id === treatmentId) ?? null : null;

  // Fetch community ratings for selected hospitals
  useEffect(() => {
    let cancelled = false;
    selected.forEach((h) => {
      if (communityMap[h.id]) return;
      fetch(`/api/reviews?hospitalId=${encodeURIComponent(h.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.summary) {
            setCommunityMap((prev) => ({ ...prev, [h.id]: d.summary }));
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [selected, communityMap]);

  const candidates = useMemo(() => {
    const queryLower = query.trim().toLowerCase();
    if (!queryLower) return [];
    return HOSPITALS.filter((h) => !ids.includes(h.id))
      .filter((h) =>
        [
          h.name,
          h.shortName,
          h.city,
          CITY_HI[h.city] ?? '',
          h.state,
          STATE_HI[h.state] ?? '',
          ...h.specialities,
          ...h.specialities.map((s) => SPECIALITY_HI[s] ?? ''),
          ...h.facilities,
          ...h.facilities.map((f) => FACILITY_HI[f] ?? ''),
        ]
          .join(' ')
          .toLowerCase()
          .includes(queryLower),
      )
      .slice(0, 8);
  }, [query, ids]);

  useEffect(() => {
    if (!full) setNotice(false);
  }, [full]);

  const tryAdd = (id: string) => {
    const ok = add(id);
    if (!ok) setNotice(true);
    else {
      setQuery('');
      setNotice(false);
    }
  };

  const updateOriginFromQuery = async () => {
    const qOrigin = originInput.trim();
    if (qOrigin.length < 2) return;
    setOriginBusy(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(qOrigin)}&lang=${encodeURIComponent(lang)}`);
      const data = await res.json();
      if (data?.results?.[0]) {
        const first = data.results[0];
        setManual(first.lat, first.lng, first.label, 'manual');
        setOriginInput('');
      }
    } catch {
      // ignore
    } finally {
      setOriginBusy(false);
    }
  };

  const travels = useMemo(
    () => selected.map((h) => estimateTravelMetrics(location.lat, location.lng, h.lat, h.lng)),
    [selected, location.lat, location.lng],
  );

  // "Best" badges — computed only over selected hospitals
  const best = useMemo(() => {
    if (selected.length < 2)
      return {
        nearest: null as string | null,
        mostSpec: null as string | null,
        mostFac: null as string | null,
        cheapest: null as string | null,
      };
    const roadDistances = travels.map((tr) => tr.roadKm);
    const nearest = selected[roadDistances.indexOf(Math.min(...roadDistances))]?.id ?? null;
    const mostSpec = selected.reduce((a, b) => (b.specialities.length > a.specialities.length ? b : a)).id;
    const mostFac = selected.reduce((a, b) => (b.facilities.length > a.facilities.length ? b : a)).id;
    let cheapest: string | null = null;
    if (treatment) {
      const est = selected.map((h) => {
        const e = estimateTreatment(
          treatment,
          {
            treatmentId: treatment.id,
            includedTests: treatment.tests.map((_, i) => i),
            stayDays: Math.max(treatment.roomPerDay ? treatment.typicalStayDays[0] : 0, 0),
            roomType: 'general',
          },
          lang,
        );
        const tot = h.type === 'government' ? e.govtTotal : e.privateTotal;
        return { id: h.id, mid: (tot[0] + tot[1]) / 2 };
      });
      cheapest = est.reduce((a, b) => (b.mid < a.mid ? b : a)).id;
    }
    return { nearest, mostSpec, mostFac, cheapest };
  }, [selected, travels, treatment, lang]);

  const estFor = (h: Hospital) => {
    if (!treatment) return null;
    const e = estimateTreatment(
      treatment,
      {
        treatmentId: treatment.id,
        includedTests: treatment.tests.map((_, i) => i),
        stayDays: treatment.roomPerDay ? Math.max(treatment.typicalStayDays[0], 1) : 0,
        roomType: 'general',
      },
      lang,
    );
    return h.type === 'government' ? e.govtTotal : e.privateTotal;
  };

  const colClass = selected.length === 3 ? 'minmax(210px,1fr)' : 'minmax(230px,1fr)';
  const treatmentDisplayName = treatment
    ? lang === 'hi' && treatment.hindiName
      ? treatment.hindiName
      : treatment.name
    : '';
  const locationDisplay =
    location.source === 'geolocation'
      ? t('yourLocationLabel')
      : location.source === 'default'
        ? t('defaultLocationLabel')
        : tPresetLabel(location.label, lang);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 print-hidden">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('compareEyebrow')}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">{t('compareTitle')}</h1>
          <p className="mt-1 text-slate-600 max-w-2xl">{t('compareSub', { max: MAX_COMPARE })}</p>
        </div>
        <div className="flex gap-2">
          {selected.length >= 2 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary !py-2.5 !text-sm print-hidden"
            >
              <Printer size={17} />
              {t('printSavePdf')}
            </button>
          )}
          {selected.length > 0 && (
            <button type="button" onClick={clear} className="btn-ghost !text-sm text-red-700 hover:bg-red-50">
              <Trash2 size={17} />
              {t('clearAll')}
            </button>
          )}
        </div>
      </div>

      {/* Add hospital + Origin + Treatment controls */}
      <div className="print-hidden card mt-4 p-4 sm:p-5 grid gap-4 lg:grid-cols-2">
        <div>
          <label htmlFor="compare-add" className="label">
            {t('addHospitalCompareLabel')}{' '}
            {selected.length > 0 && (
              <span className="font-normal text-slate-400">
                {t('selectedCountParen', { count: selected.length, max: MAX_COMPARE })}
              </span>
            )}
          </label>
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="compare-add"
              role="combobox"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('compareSearchPlaceholder')}
              className="input !pl-12"
              autoComplete="off"
              aria-expanded={candidates.length > 0}
              aria-controls="compare-suggestions"
            />
            {candidates.length > 0 && (
              <ul
                id="compare-suggestions"
                role="listbox"
                className="absolute z-20 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-100 overflow-hidden"
              >
                {candidates.map((h) => (
                  <li key={h.id} role="option" aria-selected="false">
                    <button
                      type="button"
                      onClick={() => tryAdd(h.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-50"
                    >
                      <span>
                        <span className="block font-semibold text-sm text-slate-800">{h.name}</span>
                        <span className="block text-[11px] text-slate-500">
                          {tCity(h.city, lang)} · {h.type === 'government' ? t('govtBadge') : t('privateBadge')}
                        </span>
                      </span>
                      <Plus size={18} className="text-brand-700 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {notice && (
            <p role="alert" className="mt-2 text-sm text-amber-800 font-medium">
              {t('compareMaxNotice', { max: MAX_COMPARE })}
            </p>
          )}
          {query.trim().length >= 2 && candidates.length === 0 && (
            <p role="status" className="mt-2 text-sm text-slate-500">
              {t('compareNoSearchMatch', { query: query.trim() })}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{t('suggestionsLabel')}</span>
            {['aiims-new-delhi', 'safdarjung-hospital', 'sir-ganga-ram-hospital', 'max-saket']
              .filter((id) => !ids.includes(id))
              .slice(0, 3)
              .map((id) => {
                const h = HOSPITALS.find((x) => x.id === id)!;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => tryAdd(id)}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-200 text-brand-800 font-semibold px-3 py-1.5 hover:bg-brand-50"
                  >
                    <Plus size={13} />
                    {h.shortName}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Starting location + Treatment Cost selector */}
        <div className="space-y-3">
          <div>
            <label htmlFor="cmp-origin" className="label">
              {t('distancesFromLabel')} <span className="font-bold text-brand-800">{locationDisplay}</span>
            </label>
            <div className="flex gap-2">
              <input
                id="cmp-origin"
                value={originInput}
                onChange={(e) => setOriginInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    updateOriginFromQuery();
                  }
                }}
                placeholder="Change starting place (e.g. Pusa Road, Gurugram, Mumbai)…"
                className="input !py-2.5 !text-sm"
              />
              <button
                type="button"
                onClick={updateOriginFromQuery}
                disabled={originBusy}
                className="btn-secondary !px-3.5 !py-2.5 !text-xs"
                aria-label="Update starting location"
              >
                {originBusy ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
              </button>
              <button
                type="button"
                onClick={requestGeolocation}
                disabled={geoStatus === 'locating'}
                className="btn-ghost !px-3 !py-2.5 !text-xs border border-slate-200"
                title={t('useMyLocation')}
              >
                <LocateFixed size={16} />
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CITY_PRESETS.slice(0, 5).map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setManual(c.lat, c.lng, `${c.label}, ${c.state}`, 'preset')}
                  className="text-[11px] font-semibold rounded-full border border-slate-200 px-2.5 py-0.5 text-slate-600 hover:border-brand-500 hover:text-brand-800"
                >
                  {tCity(c.label, lang)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="cmp-treatment" className="label">
              {t('estimateCostOptional')}
            </label>
            <select
              id="cmp-treatment"
              value={treatmentId}
              onChange={(e) => setTreatmentId(e.target.value)}
              className="input appearance-none !py-2.5 !text-sm"
            >
              <option value="">{t('noCostComparison')}</option>
              {TREATMENTS.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {lang === 'hi' && tr.hindiName ? tr.hindiName : tr.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {selected.length === 0 && (
        <div className="card mt-6 p-10 text-center">
          <GitCompareArrows className="mx-auto text-brand-200" size={52} strokeWidth={1.5} />
          <h2 className="mt-3 font-extrabold text-2xl text-slate-800">{t('nothingToCompareTitle')}</h2>
          <p className="mt-1 text-slate-600 max-w-md mx-auto">{t('nothingToCompareDesc')}</p>
          <Link href="/hospitals" className="btn-primary mt-5">
            {t('findHospitalsToCompare')}
          </Link>
        </div>
      )}

      {/* Comparison table */}
      {selected.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
          <div
            className="min-w-[740px] grid"
            style={{ gridTemplateColumns: `165px repeat(${selected.length}, ${colClass})` }}
          >
            {/* Header row */}
            <div className="bg-brand-950 text-white px-4 py-4 text-xs font-bold uppercase tracking-wider flex items-end">
              {t('sideBySide')}
            </div>
            {selected.map((h) => (
              <div key={h.id} className="bg-brand-950 text-white px-4 py-4">
                <p className="font-extrabold leading-snug">{h.name}</p>
                <p className="text-[11px] text-brand-200 mt-1">
                  {tCity(h.city, lang)}, {tState(h.state, lang)}
                </p>
                <button
                  type="button"
                  onClick={() => remove(h.id)}
                  className="print-hidden mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-red-300 hover:text-white border border-red-400/40 hover:border-white rounded-lg px-2.5 py-1.5"
                >
                  <X size={13} /> {t('removeBtn')}
                </button>
                <div className="print-hidden mt-2 flex gap-2">
                  {h.phone && (
                    <a
                      href={`tel:${h.phone}`}
                      aria-label={t('callHospitalAria', { name: h.shortName })}
                      className="text-brand-100 hover:text-white"
                    >
                      <PhoneCall size={17} />
                    </a>
                  )}
                  <a
                    href={directionsUrl(h.lat, h.lng, h.shortName, { lat: location.lat, lng: location.lng })}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('directionsHospitalAria', { name: h.shortName })}
                    className="text-brand-100 hover:text-white"
                  >
                    <Navigation size={17} />
                  </a>
                </div>
              </div>
            ))}

            {/* Road Distance + ETA */}
            <Row label={`${t('roadDistLabel')} & ETA`}>
              {selected.map((h, i) => (
                <Cell key={h.id}>
                  <p className="text-lg font-extrabold text-brand-900" data-testid={`compare-dist-${h.id}`}>
                    {formatDistance(travels[i].roadKm, lang)}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1 mt-0.5" data-testid={`compare-eta-${h.id}`}>
                    <Clock size={12} /> ~{formatDuration(travels[i].trafficMinutes, lang)}
                  </p>
                  {best.nearest === h.id && <Badge text={t('nearestBadge')} />}
                </Cell>
              ))}
            </Row>

            {/* Community Score */}
            <Row label={t('communityScoreLabel')} zebra>
              {selected.map((h) => {
                const comm = communityMap[h.id];
                return (
                  <Cell key={h.id} zebra>
                    {comm && comm.imdbScaleScore !== null ? (
                      <div>
                        <p className="text-base font-black text-amber-900 inline-flex items-center gap-1">
                          <Star size={14} className="fill-amber-500 text-amber-500" />
                          {comm.imdbScaleScore.toFixed(1)}/10
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {comm.eligibleCount} community {comm.eligibleCount === 1 ? 'review' : 'reviews'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No eligible community reviews yet</span>
                    )}
                  </Cell>
                );
              })}
            </Row>

            {/* Type */}
            <Row label={t('rowType')}>
              {selected.map((h) => (
                <Cell key={h.id}>
                  <span className={h.type === 'government' ? 'chip' : 'chip-grey'}>
                    {h.type === 'government' ? t('govtBadge') : t('privateBadge')}
                  </span>
                  <p className="mt-1.5 text-[11px] text-slate-500">{t(PROFILE_KEY[h.costProfile])}</p>
                </Cell>
              ))}
            </Row>

            {/* Emergency */}
            <Row label={t('rowEmergency247')} zebra>
              {selected.map((h) => {
                const emNote = tHospitalMeta(h.id, 'emergencyNote', h.emergencyNote, lang);
                return (
                  <Cell key={h.id} zebra>
                    {h.emergency === 'verified' ? (
                      <span className="chip-red">
                        <Check size={12} strokeWidth={3} />
                        {t('verified247Short')}
                      </span>
                    ) : h.emergency === 'unverified' ? (
                      <span className="chip-amber">{t('unverified')}</span>
                    ) : (
                      <span className="chip-grey">{t('notAvailableShort')}</span>
                    )}
                    {emNote && <p className="mt-1.5 text-[10px] text-slate-500">{emNote}</p>}
                  </Cell>
                );
              })}
            </Row>

            {/* OPD */}
            <Row label={t('rowOpdTimings')}>
              {selected.map((h) => {
                const opd = tHospitalMeta(h.id, 'opdTimings', h.opdTimings, lang);
                const statusLabel =
                  h.opdStatus === 'verified'
                    ? t('verified')
                    : h.opdStatus === 'unverified'
                      ? t('unverified')
                      : t('unavailable');
                return (
                  <Cell key={h.id}>
                    <p className="text-[12px] text-slate-700 leading-snug">{opd ?? t('opdNotListedCall')}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide font-bold text-slate-400">
                      {statusLabel}
                    </p>
                  </Cell>
                );
              })}
            </Row>

            {/* Beds */}
            <Row label={t('rowBedsApprox')} zebra>
              {selected.map((h) => (
                <Cell key={h.id} zebra>
                  {h.beds ? (
                    <p className="font-bold">~{h.beds.toLocaleString('en-IN')}</p>
                  ) : (
                    <span className="text-slate-400">{t('unavailable')}</span>
                  )}
                </Cell>
              ))}
            </Row>

            {/* Specialities */}
            <Row label={t('rowSpecialities')}>
              {selected.map((h) => (
                <Cell key={h.id}>
                  <p className="font-extrabold text-brand-900">
                    {t('departmentsCount', { count: h.specialities.length })}{' '}
                    {best.mostSpec === h.id && best.nearest !== null && selected.length > 1 && (
                      <Badge text={t('mostBadge')} />
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {h.specialities.slice(0, 6).map((s) => (
                      <span key={s} className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                        {tSpeciality(s, lang)}
                      </span>
                    ))}
                    {h.specialities.length > 6 && (
                      <span className="text-[10px] text-slate-400">+{h.specialities.length - 6}</span>
                    )}
                  </div>
                </Cell>
              ))}
            </Row>

            {/* Key facilities */}
            <Row label={t('rowKeyFacilities')} zebra>
              {selected.map((h) => (
                <Cell key={h.id} zebra>
                  <ul className="text-[11px] space-y-1">
                    {KEY_FACILITIES.map((f) => {
                      const hasFac = h.facilities.includes(f);
                      return (
                        <li key={f} className="flex items-center gap-1.5">
                          {hasFac ? (
                            <Check size={12} strokeWidth={3} className="text-green-700 shrink-0" />
                          ) : (
                            <Minus size={12} strokeWidth={3} className="text-slate-300 shrink-0" />
                          )}
                          <span className={hasFac ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            {tFacility(f, lang)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-1.5 text-[10px] text-slate-500">
                    {t('totalFacilitiesListed', { count: h.facilities.length })}{' '}
                    {best.mostFac === h.id && selected.length > 1 && <Badge text={t('mostBadge')} />}
                  </p>
                </Cell>
              ))}
            </Row>

            {/* Cost estimate row — only when treatment selected */}
            {treatment && (
              <Row label={t('rowEstCostPrefix', { name: treatmentDisplayName })}>
                {selected.map((h) => {
                  const est = estFor(h)!;
                  return (
                    <Cell key={h.id}>
                      <p className="font-extrabold text-slate-900 leading-snug">
                        {formatRange(est[0], est[1])}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {h.type === 'government' ? t('govtIndicativeRange') : t('privateIndicativeRange')}
                      </p>
                      {best.cheapest === h.id && <Badge text={t('lowestEstCostBadge')} />}
                    </Cell>
                  );
                })}
              </Row>
            )}

            {/* Contact */}
            <Row label={t('rowContact')} zebra={Boolean(treatment)}>
              {selected.map((h) => (
                <Cell key={h.id} zebra={Boolean(treatment)}>
                  {h.phone ? (
                    <a
                      href={`tel:${h.phone}`}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-800 hover:underline"
                    >
                      <PhoneCall size={14} />
                      {h.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">{t('notListedCall104')}</span>
                  )}
                  <div className="mt-1.5 flex flex-col gap-1">
                    <a
                      href={directionsUrl(h.lat, h.lng, h.shortName, {
                        lat: location.lat,
                        lng: location.lng,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-800 hover:underline"
                    >
                      <Navigation size={12} />
                      {t('getDirections')}
                    </a>
                    <Link
                      href={`/hospitals/${h.id}`}
                      className="text-xs font-bold text-brand-800 hover:underline"
                    >
                      {t('fullDetailsLink')}
                    </Link>
                  </div>
                </Cell>
              ))}
            </Row>

            {/* Decision strip */}
            <div className="grid col-span-full bg-amber-50 border-t border-amber-200 px-4 py-3 text-[11px] text-amber-950 flex items-start gap-2">
              <Info size={15} className="mt-0.5 shrink-0" />
              <p>
                {t('compareDecisionNotePre')}
                <strong>{t('compareDecisionNoteStrong')}</strong>
                {t('compareDecisionNoteMid')}
                <Link href="/disclaimer" className="underline font-bold">
                  {t('readDataDisclaimer')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children, zebra = false }: { label: string; children: React.ReactNode; zebra?: boolean }) {
  return (
    <>
      <div
        className={`px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 self-stretch flex items-center border-t border-slate-100 ${
          zebra ? 'bg-slate-50/70' : ''
        }`}
      >
        {label}
      </div>
      {children}
    </>
  );
}
function Cell({ children, zebra = false }: { children: React.ReactNode; zebra?: boolean }) {
  return <div className={`px-4 py-3 border-t border-slate-100 ${zebra ? 'bg-slate-50/40' : ''}`}>{children}</div>;
}
function Badge({ text }: { text: string }) {
  return (
    <span className="print-hidden mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5">
      <Trophy size={11} />
      {text}
    </span>
  );
}
