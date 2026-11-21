'use client';

import { Coins, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { TREATMENTS } from '@/data/treatments';
import { useLang } from '@/lib/i18n';
import { tTreatmentCategory } from '@/lib/i18n-data';

const CATEGORIES = Array.from(new Set(TREATMENTS.map((t) => t.category)));

/**
 * Treatment selector for the nearby-results list.
 *
 * Changing it re-fetches the batch of hospital cost previews (one request), so
 * every visible card updates together. The choice is kept in session storage so
 * the estimator → results → detail journey stays on the same treatment.
 */
export default function TreatmentSelector({
  value,
  onChange,
  fromEstimator,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  fromEstimator?: boolean;
}) {
  const { t, lang } = useLang();
  const selected = TREATMENTS.find((tr) => tr.id === value);

  return (
    <div className="card p-3 sm:p-4" data-testid="treatment-selector">
      <label htmlFor="treatment-select" className="label flex items-center gap-1.5 !text-xs">
        <Coins size={14} className="text-brand-700" aria-hidden="true" />
        {t('treatmentSelectorLabel')}
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          id="treatment-select"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="input min-w-0 flex-1 !py-2.5 !text-sm"
        >
          <option value="">{t('treatmentSelectorAny')}</option>
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
        <Link
          href={value ? `/cost-estimator?treatment=${encodeURIComponent(value)}` : '/cost-estimator'}
          className="inline-flex items-center gap-1 text-xs font-bold text-brand-800 underline underline-offset-2"
        >
          {t('costPreviewEstimatorLink')} <ExternalLink size={12} />
        </Link>
      </div>
      {selected ? (
        <p className="mt-1.5 text-[11px] text-slate-600">
          {t('treatmentSelectorHint', {
            name: lang === 'hi' && selected.hindiName ? selected.hindiName : selected.name,
          })}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-500">{t('costPreviewGenericNote')}</p>
      )}
      {fromEstimator && selected && (
        <p className="mt-1 text-[11px] font-semibold text-brand-800" data-testid="cost-from-estimator">
          {t('costPreviewFromEstimator')}
        </p>
      )}
    </div>
  );
}
