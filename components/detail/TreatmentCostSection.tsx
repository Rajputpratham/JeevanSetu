'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, ChevronDown, Info, IndianRupee } from 'lucide-react';
import { TREATMENTS } from '@/data/treatments';
import { useLang } from '@/lib/i18n';
import { tTreatmentCategory } from '@/lib/i18n-data';
import { formatINR } from '@/lib/format';
import { useCostPreviews } from '@/hooks/useCostPreviews';
import { useTreatmentSelection } from '@/lib/treatment-selection';
import { KIND_LABEL_I18N } from '@/lib/hospital-costs';

const CATEGORIES = Array.from(new Set(TREATMENTS.map((t) => t.category)));

/**
 * DETAIL-PAGE treatment cost evidence.
 *
 * Shows, for one hospital branch and one treatment: the strongest verified
 * evidence (scheme package → hospital tariff/quote), its source + dates +
 * inclusions/exclusions, the exact coverage sentence when a scheme applies, the
 * count of community bill observations (kept separate), and — only inside an
 * explicitly labelled "generic range" block — the estimator's indicative range.
 *
 * It never prints ₹0, never presents the generic range as the hospital's price,
 * and says "Cost estimate unavailable" when nothing branch-specific is verified.
 */
export default function TreatmentCostSection({ hospitalId }: { hospitalId: string }) {
  const { t, lang } = useLang();
  const selection = useTreatmentSelection();
  const [expanded, setExpanded] = useState(false);
  const treatmentId = selection.treatmentId ?? 'normal-delivery';
  const { loading, failed, forHospital } = useCostPreviews(treatmentId, [hospitalId], lang);
  const treatment = useMemo(() => TREATMENTS.find((tr) => tr.id === treatmentId), [treatmentId]);
  const preview = forHospital(hospitalId);

  const figure = preview?.figure ?? null;
  const pick = (v: { en: string; hi: string } | null | undefined) => (v ? (lang === 'hi' ? v.hi : v.en) : '');

  return (
    <section aria-labelledby="treatment-cost" className="card p-5 sm:p-6" data-testid="treatment-cost-section">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="treatment-cost" className="flex items-center gap-2 font-extrabold text-lg text-slate-900">
          <IndianRupee className="text-brand-700" size={20} />
          {t('costPreviewTitle')}
        </h2>
        <Link href={`/cost-estimator?treatment=${encodeURIComponent(treatmentId)}`} className="inline-flex items-center gap-1 text-xs font-bold text-brand-800 underline">
          <Calculator size={13} /> {t('costPreviewEstimatorLink')}
        </Link>
      </div>

      <div className="mt-3">
        <label htmlFor="detail-treatment" className="label !text-xs">
          {t('treatmentSelectorLabel')}
        </label>
        <select
          id="detail-treatment"
          value={treatmentId}
          onChange={(e) => selection.setTreatmentId(e.target.value)}
          className="input mt-1 !py-2.5 !text-sm"
        >
          {CATEGORIES.map((cat) => (
            <optgroup key={cat} label={tTreatmentCategory(cat, lang)}>
              {TREATMENTS.filter((tr) => tr.category === cat).map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {lang === 'hi' && tr.hindiName ? tr.hindiName : tr.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-3 text-sm font-semibold text-slate-500">{t('costPreviewLoading')}</p>
      ) : failed || !preview ? (
        <p className="mt-3 text-sm font-semibold text-amber-900">{t('costPreviewLoadingFailed')}</p>
      ) : (
        <>
          {figure ? (
            <div className="mt-3 rounded-xl border-2 border-brand-200 bg-brand-50/60 px-4 py-3" data-testid="cost-figure">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700">
                {t('costPreviewHospitalPrice')} · {pick(KIND_LABEL_I18N[figure.kind])}
              </p>
              <p className="mt-0.5 text-2xl font-black text-brand-950">
                {formatINR(figure.amount.min)}
                {figure.amount.max !== figure.amount.min ? ` – ${formatINR(figure.amount.max)}` : ''}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                {t('costPreviewSource')}: {figure.sourceLabel} · {t('costPreviewEffective')}:{' '}
                {figure.effectiveOn ?? '—'} · {t('costPreviewChecked')}: {figure.lastCheckedOn}
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" data-testid="cost-unavailable">
              <p className="text-sm font-bold text-slate-900">{t('costPreviewUnavailable')}</p>
              <p className="mt-1 text-xs text-slate-600">{t('costPreviewNoneForBranch')}</p>
            </div>
          )}

          {preview.coverageNote && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950" data-testid="coverage-note">
              {pick(preview.coverageNote)}
            </p>
          )}

          {preview.community && (
            <p className="mt-2 text-xs text-slate-700" data-testid="detail-community-bills">
              <strong>{t('costPreviewCommunityCount', { count: preview.community.count })}</strong> —{' '}
              {t('costPreviewCommunityNote')}
            </p>
          )}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-3 inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-brand-800 underline underline-offset-2"
          >
            {t('costPreviewSeeDetails')}
            <ChevronDown size={13} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
              {figure && (
                <>
                  {figure.inclusions.length > 0 && (
                    <p>
                      <strong>{t('costPreviewInclusions')}:</strong> {figure.inclusions.join(', ')}
                    </p>
                  )}
                  {figure.exclusions.length > 0 && (
                    <p>
                      <strong>{t('costPreviewExclusions')}:</strong> {figure.exclusions.join(', ')}
                    </p>
                  )}
                  <p>{t('costPreviewConfidence', { level: figure.confidence })}</p>
                  <a href={figure.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-800 underline">
                    {t('costPreviewSource')} ↗
                  </a>
                </>
              )}
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <p className="font-bold text-slate-700">{t('costPreviewGenericRange')}</p>
                <p className="mt-0.5">
                  {formatINR(preview.generic.private.min)} – {formatINR(preview.generic.private.max)} ({preview.generic.asOf})
                </p>
                <p className="mt-1 italic">{t('costPreviewGenericNote')}</p>
              </div>
              {treatment && treatment.roomPerDay === null && treatment.procedure === null && (
                <p className="flex items-start gap-1.5">
                  <Info size={12} className="mt-0.5 shrink-0" /> {t('costPreviewOpdNote')}
                </p>
              )}
              <p className="text-slate-500">{treatment?.sourceNote}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
