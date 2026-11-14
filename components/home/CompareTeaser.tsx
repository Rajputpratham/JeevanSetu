'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { HOSPITALS } from '@/data/hospitals';
import { useUserLocation } from '@/lib/useLocation';
import { formatDrivingKm, formatStraightLineKm, directionsUrl } from '@/lib/geo';
import { distanceStrings } from '@/lib/ui-strings';
import { useLang } from '@/lib/i18n';
import { GitCompareArrows, PhoneCall, Navigation, MapPin } from 'lucide-react';

interface LegInfo {
  distanceKm: number | null;
  etaMinutes: number | null;
  straightKm: number | null;
}

/**
 * Homepage comparison teaser.
 *
 * The distance row previously used raw Haversine (straight-line) values while
 * the hospital cards showed modelled road distances — two different numbers for
 * the same trip. Both now read the SAME Google Routes snapshot from
 * `/api/travel`, and the straight-line value is only shown with its own label.
 */
export default function CompareTeaser() {
  const [aId, setAId] = useState('aiims-new-delhi');
  const [bId, setBId] = useState('safdarjung-hospital');
  const { location, hasLocation } = useUserLocation();
  const { lang } = useLang();
  const ds = distanceStrings(lang);

  const a = HOSPITALS.find((h) => h.id === aId)!;
  const b = HOSPITALS.find((h) => h.id === bId)!;

  const [legs, setLegs] = useState<Record<string, LegInfo>>({});

  useEffect(() => {
    if (!hasLocation) {
      setLegs({});
      return;
    }
    let cancelled = false;
    fetch(
      `/api/travel?lat=${location.lat}&lng=${location.lng}&source=${location.source}&ids=${encodeURIComponent(
        `${aId},${bId}`,
      )}&lang=${lang}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { hospitals?: { id: string; distanceKm: number | null; etaMinutes: number | null; straightKm: number | null }[] } | null) => {
        if (cancelled || !data?.hospitals) return;
        const next: Record<string, LegInfo> = {};
        for (const h of data.hospitals) {
          next[h.id] = { distanceKm: h.distanceKm, etaMinutes: h.etaMinutes, straightKm: h.straightKm };
        }
        setLegs(next);
      })
      .catch(() => {
        if (!cancelled) setLegs({});
      });
    return () => {
      cancelled = true;
    };
  }, [aId, bId, hasLocation, location.lat, location.lng, location.source, lang]);

  const distanceCell = (id: string) => {
    const leg = legs[id];
    const driving = formatDrivingKm(leg?.distanceKm ?? null, lang);
    if (driving) return driving;
    const straight = formatStraightLineKm(leg?.straightKm ?? null, lang);
    if (straight) return `${straight} (${ds.straightLine.toLowerCase()})`;
    return ds.distanceUnavailable;
  };

  const rows: { label: string; va: string; vb: string }[] = useMemo(
    () => [
      { label: 'Type', va: a.type === 'government' ? 'Government' : 'Private', vb: b.type === 'government' ? 'Government' : 'Private' },
      { label: ds.drivingDistance, va: distanceCell(a.id), vb: distanceCell(b.id) },
      { label: 'Cost profile', va: a.costProfile.replace('-', ' '), vb: b.costProfile.replace('-', ' ') },
      {
        label: 'Emergency 24×7',
        va: a.emergency === 'verified' ? 'Verified' : a.emergency === 'unverified' ? 'Unverified' : 'No',
        vb: b.emergency === 'verified' ? 'Verified' : b.emergency === 'unverified' ? 'Unverified' : 'No',
      },
      { label: 'No. of specialities', va: String(a.specialities.length), vb: String(b.specialities.length) },
      { label: 'Facilities', va: `${a.facilities.length} listed`, vb: `${b.facilities.length} listed` },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a, b, legs, lang],
  );

  const selectClass = 'input !py-2.5 text-sm appearance-none';

  return (
    <section aria-labelledby="compare-teaser" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Step 3 · Compare</p>
      <h2 id="compare-teaser" className="section-title mt-1">Compare hospitals side by side</h2>
      <p className="section-sub text-sm">
        Pick any two hospitals — government or private — and see the facts that matter to a family decision.
      </p>

      <div className="card mt-6 p-4 sm:p-6 overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[140px_1fr_1fr] gap-2 items-center">
            <div />
            {[{ h: a, id: aId, set: setAId }, { h: b, id: bId, set: setBId }].map(({ h, id, set }) => (
              <div key={id} className="rounded-xl bg-brand-50 border border-brand-200 p-3">
                <label htmlFor={`pick-${id}`} className="sr-only">Choose hospital</label>
                <select id={`pick-${id}`} value={id} onChange={(e) => set(e.target.value)} className={selectClass}>
                  {HOSPITALS.map((hosp) => (
                    <option key={hosp.id} value={hosp.id}>{hosp.shortName}</option>
                  ))}
                </select>
                <div className="mt-2 flex items-center gap-3 px-1 pb-1">
                  {h.phone && (
                    <a href={`tel:${h.phone}`} aria-label={`Call ${h.shortName}`} className="text-brand-800 hover:text-brand-600">
                      <PhoneCall size={18} />
                    </a>
                  )}
                  <a
                    href={directionsUrl(
                      h.lat,
                      h.lng,
                      h.shortName,
                      typeof location.lat === 'number' && typeof location.lng === 'number'
                        ? { lat: location.lat, lng: location.lng }
                        : null,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Directions to ${h.shortName}`}
                    className="text-brand-800 hover:text-brand-600"
                  >
                    <Navigation size={18} />
                  </a>
                </div>
              </div>
            ))}
          </div>
          <dl>
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[140px_1fr_1fr] gap-2 border-b border-slate-100 last:border-0 py-2.5">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500 self-center">{row.label}</dt>
                <dd className="text-sm font-semibold text-slate-800 self-center">{row.va}</dd>
                <dd className="text-sm font-semibold text-slate-800 self-center">{row.vb}</dd>
              </div>
            ))}
          </dl>
          {!hasLocation && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              {ds.distanceUnavailableWhy} Share your location to compare real driving distances.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <GitCompareArrows size={15} /> Distances use the same Google route as the hospital cards
            </p>
            <Link href="/compare" className="btn-primary !py-2.5 !text-sm">Open full comparison →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
