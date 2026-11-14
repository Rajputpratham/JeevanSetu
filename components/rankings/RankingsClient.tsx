'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Trophy, Star, Siren, Landmark, Building2, Info, Navigation, Clock, GitCompareArrows, Check,
} from 'lucide-react';
import { ALL_SPECIALITIES, HOSPITALS } from '@/data/hospitals';
import { useLang } from '@/lib/i18n';
import { tCity, tSpeciality, tState } from '@/lib/i18n-data';
import { useUserLocation } from '@/lib/useLocation';
import LocationControls from '@/components/LocationControls';
import { useCompare } from '@/lib/compare';
import { directionsUrl, formatDrivingKm as formatDriving, formatDuration } from '@/lib/geo';
import { locationStrings } from '@/lib/ui-strings';
import type { RankedHospitalEntry } from '@/lib/ratings';

type LeaderboardRow = RankedHospitalEntry & {
  /** Google road distance; null when unknown (never modelled). */
  roadKm: number | null;
  etaMinutes: number | null;
};

const ALL_CITIES = Array.from(new Set(HOSPITALS.map((h) => h.city))).sort();

export default function RankingsClient() {
  const { t, lang } = useLang();
  const { location, hasLocation } = useUserLocation();
  const { has, toggle } = useCompare();

  const [city, setCity] = useState('');
  const [type, setType] = useState<'all' | 'government' | 'private'>('all');
  const [speciality, setSpeciality] = useState('');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [methodology, setMethodology] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      type,
    });
    // Deliberately omit lat/lng when unknown: the API must not assume Delhi.
    if (hasLocation) {
      params.set('lat', String(location.lat));
      params.set('lng', String(location.lng));
    }
    if (city) params.set('city', city);
    if (speciality) params.set('speciality', speciality);
    if (emergencyOnly) params.set('emergency', '1');

    fetch(`/api/rankings?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data) => {
        if (!cancelled) {
          setRows(data.results ?? []);
          setMethodology(data.methodology ?? '');
        }
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [city, type, speciality, emergencyOnly, hasLocation, location.lat, location.lng]);

  const topThree = useMemo(() => (rows ?? []).slice(0, 3), [rows]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-4">
        <LocationControls compact />
      </div>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700 flex items-center gap-1.5">
            <Trophy size={14} /> {t('rankingsEyebrow')}
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">
            {t('rankingsTitle')}
          </h1>
          <p className="mt-1 text-slate-600 max-w-3xl">{t('rankingsSub')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 card p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label htmlFor="rk-city" className="label !text-xs">
            City
          </label>
          <select
            id="rk-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input !py-2.5 !text-sm"
          >
            <option value="">All cities ({ALL_CITIES.length})</option>
            {ALL_CITIES.map((c) => (
              <option key={c} value={c}>
                {tCity(c, lang)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rk-type" className="label !text-xs">
            {t('filterTypeLabel')}
          </label>
          <select
            id="rk-type"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="input !py-2.5 !text-sm"
          >
            <option value="all">{t('filterTypeAll')}</option>
            <option value="government">{t('filterTypeGovt')}</option>
            <option value="private">{t('filterTypePrivate')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="rk-spec" className="label !text-xs">
            {t('filterSpecLabel')}
          </label>
          <select
            id="rk-spec"
            value={speciality}
            onChange={(e) => setSpeciality(e.target.value)}
            className="input !py-2.5 !text-sm"
          >
            <option value="">{t('allSpecialities')}</option>
            {ALL_SPECIALITIES.map((s) => (
              <option key={s} value={s}>
                {tSpeciality(s, lang)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 w-full min-h-[46px]">
            <input
              type="checkbox"
              checked={emergencyOnly}
              onChange={(e) => setEmergencyOnly(e.target.checked)}
              className="w-5 h-5 accent-red-700"
            />
            <span className="text-sm font-bold text-red-800 flex items-center gap-1.5">
              <Siren size={16} />
              {t('emergency247')}
            </span>
          </label>
        </div>
      </div>

      {/* Methodology disclosure */}
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-950 flex items-start gap-2">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-700" />
        <p>
          <strong>Transparent Methodology:</strong>{' '}
          {methodology ||
            'Composite Score (0–100) combines Verified Facilities (30), Speciality Breadth (25), Verified 24×7 Emergency (15), Public Affordability (15), and IMDb-style Bayesian Community Score (15). This leaderboard reflects infrastructure breadth, affordability, and community experience — never a paid placement or clinical survival claim.'}
        </p>
      </div>

      {/* Podium cards for top 3 */}
      {topThree.length > 0 && (
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {topThree.map((entry) => {
            const h = entry.hospital;
            const medalColors =
              entry.rank === 1
                ? 'bg-amber-400 text-amber-950 ring-amber-200'
                : entry.rank === 2
                  ? 'bg-slate-300 text-slate-900 ring-slate-200'
                  : 'bg-orange-300 text-orange-950 ring-orange-100';
            return (
              <div key={h.id} className="card p-5 border-2 border-brand-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-black text-base ring-4 ${medalColors}`}
                    >
                      #{entry.rank}
                    </span>
                    <span className="rounded-xl bg-brand-900 text-white px-3 py-1 text-sm font-black">
                      {entry.compositeScore} / 100
                    </span>
                  </div>
                  <h2 className="mt-3 font-extrabold text-lg text-slate-900 leading-snug">
                    <Link href={`/hospitals/${h.id}`} className="hover:text-brand-800 hover:underline">
                      {h.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {tCity(h.city, lang)}, {tState(h.state, lang)} ·{' '}
                    {h.type === 'government' ? t('govtBadge') : t('privateBadge')}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {entry.community.imdbScaleScore !== null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 text-amber-950 px-2.5 py-0.5 font-extrabold">
                        <Star size={12} className="fill-amber-500 text-amber-500" />
                        {entry.community.imdbScaleScore.toFixed(1)}/10 ({entry.community.eligibleCount})
                      </span>
                    )}
                    <span className="chip-grey">
                      {formatDriving(entry.roadKm, lang) ?? locationStrings(lang).notSet}
                      {typeof entry.etaMinutes === 'number' && ` · ~${formatDuration(entry.etaMinutes, lang)}`}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link href={`/hospitals/${h.id}`} className="font-extrabold text-brand-800 hover:underline">
                    {t('viewDetails')} →
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(h.id)}
                    className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-brand-800"
                  >
                    {has(h.id) ? <Check size={14} /> : <GitCompareArrows size={14} />}
                    {has(h.id) ? t('inCompare') : t('compareBtn')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="mt-6 card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="bg-brand-950 text-white text-left text-xs uppercase tracking-wider">
              <th className="px-4 py-3.5">Rank</th>
              <th className="px-4 py-3.5">Hospital</th>
              <th className="px-4 py-3.5">Composite</th>
              <th className="px-4 py-3.5">{t('communityScoreLabel')}</th>
              <th className="px-4 py-3.5">Score Breakdown</th>
              <th className="px-4 py-3.5">{t('roadDistLabel')} &amp; ETA</th>
              <th className="px-4 py-3.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Loading leaderboard…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hospitals match the selected filters.
                </td>
              </tr>
            ) : (
              rows.map((entry) => {
                const h = entry.hospital;
                const b = entry.breakdown;
                return (
                  <tr key={h.id} className="hover:bg-brand-50/40 transition-colors">
                    <td className="px-4 py-3.5 font-black text-brand-900">#{entry.rank}</td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/hospitals/${h.id}`}
                        className="font-bold text-slate-900 hover:text-brand-800 hover:underline block"
                      >
                        {h.name}
                      </Link>
                      <span className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        {h.type === 'government' ? (
                          <span className="inline-flex items-center gap-1 text-green-800 font-semibold">
                            <Landmark size={12} /> {t('govtBadge')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sky-800 font-semibold">
                            <Building2 size={12} /> {t('privateBadge')}
                          </span>
                        )}
                        · {tCity(h.city, lang)}
                        {h.emergency === 'verified' && (
                          <span className="text-red-700 font-bold">· 24×7 Emergency</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block rounded-lg bg-brand-100 text-brand-950 font-black px-2.5 py-1">
                        {entry.compositeScore}/100
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {entry.community.imdbScaleScore !== null ? (
                        <span className="inline-flex items-center gap-1 font-extrabold text-amber-800">
                          <Star size={14} className="fill-amber-500 text-amber-500" />
                          {entry.community.imdbScaleScore.toFixed(1)}/10
                          <span className="text-xs font-normal text-slate-500">
                            ({entry.community.eligibleCount})
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Unreviewed (prior)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-slate-600">
                      Fac {b.facilitiesPts}/30 · Spec {b.specialitiesPts}/25 · Emg {b.emergencyPts}/15 · Cost{' '}
                      {b.affordabilityPts}/15 · Comm {b.communityPts}/15
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      {typeof entry.roadKm === 'number' ? (
                        <>
                          <span
                            className="font-bold text-slate-900 block"
                            data-testid="ranking-distance"
                          >
                            {formatDriving(entry.roadKm, lang) ?? '—'}
                          </span>
                          <span className="text-slate-500 inline-flex items-center gap-1">
                            <Clock size={11} /> ~{formatDuration(entry.etaMinutes, lang)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Share your location to see driving distance
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
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
                          className="p-2 rounded-lg border border-slate-200 text-brand-800 hover:bg-brand-50"
                        >
                          <Navigation size={15} />
                        </a>
                        <Link
                          href={`/hospitals/${h.id}`}
                          className="text-xs font-bold text-brand-800 hover:underline whitespace-nowrap"
                        >
                          {t('viewDetails')} →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
