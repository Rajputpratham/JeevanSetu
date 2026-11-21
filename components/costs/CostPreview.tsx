'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { CostPreview, CostPreviewState } from '@/lib/hospital-costs';
import { KIND_LABEL_I18N } from '@/lib/hospital-costs';

export interface CostPreviewPayload {
  hospitalId: string;
  state: CostPreviewState;
  figure: CostPreview['figure'];
  coverageNote: { en: string; hi: string } | null;
  generic: CostPreview['generic'];
  community: CostPreview['community'];
}

function pick(v: { en: string; hi: string } | null | undefined, lang: string): string {
  if (!v) return '';
  return lang === 'hi' ? v.hi : v.en;
}

/**
 * CARD-LEVEL compact preview: one figure line, details behind a toggle.
 *
 * A hospital-specific figure is only rendered when a verified record exists.
 * Otherwise the card says "Cost estimate unavailable" or the exact PM-JAY
 * coverage sentence — the generic treatment range is never promoted into this
 * hospital's price slot (it appears only inside the expanded note, explicitly
 * labelled as generic).
 */
export default function CostPreviewCompact({
  preview,
  treatmentName,
  loading,
  failed,
}: {
  preview: CostPreviewPayload | null;
  treatmentName: string;
  loading: boolean;
  failed?: boolean;
}) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <p className="mt-2 text-[11px] font-semibold text-slate-500" data-testid="cost-preview-loading">
        {t('costPreviewLoading')}
      </p>
    );
  }
  if (failed || !preview) {
    return (
      <p className="mt-2 text-[11px] font-semibold text-amber-900" data-testid="cost-preview-failed">
        {t('costPreviewLoadingFailed')}
      </p>
    );
  }

  const figure = preview.figure;
  const hasGenericRange = preview.generic.private.max > 0 || preview.generic.govt.max > 0;
  const stateLabel =
    preview.state === 'hospital-price'
      ? t('costPreviewHospitalPrice')
      : preview.state === 'potentially-covered'
        ? t('costPreviewPotentiallyCovered')
        : t('costPreviewUnavailable');

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-2" data-testid="cost-preview">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
        {t('costPreviewTitle')} · {treatmentName}
      </p>

      {figure ? (
        <p className="mt-0.5 text-sm font-extrabold text-slate-900">
          {formatINR(figure.amount.min)}
          {figure.amount.max !== figure.amount.min ? ` – ${formatINR(figure.amount.max)}` : ''}
          <span className="ml-1 text-[10px] font-semibold text-slate-500">
            {pick(KIND_LABEL_I18N[figure.kind], lang)}
          </span>
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] font-bold text-slate-800" data-testid="cost-preview-state" data-state={preview.state}>
          {stateLabel}
        </p>
      )}

      {preview.community && (
        <p className="mt-0.5 text-[10px] text-slate-500" data-testid="cost-preview-community-count">
          {t('costPreviewCommunityCount', { count: preview.community.count })}
        </p>
      )}

      {(figure || hasGenericRange) && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-1 inline-flex min-h-[28px] items-center gap-1 text-[10px] font-bold text-brand-800 underline underline-offset-2"
          >
            {t('costPreviewSeeDetails')}
            <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          {open && (
            <div className="mt-1 space-y-1 text-[10px] leading-snug text-slate-600">
              {figure ? (
                <>
                  <p>
                    <strong>{t('costPreviewSource')}:</strong> {figure.sourceLabel}
                  </p>
                  <p>
                    {t('costPreviewEffective')}: {figure.effectiveOn ?? '—'} · {t('costPreviewChecked')}:{' '}
                    {figure.lastCheckedOn}
                  </p>
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
                </>
              ) : (
                <>
                  <p>{t('costPreviewNoneForBranch')}</p>
                  {hasGenericRange && (
                    <p>
                      <strong>{t('costPreviewGenericRange')}:</strong>{' '}
                      {formatINR(preview.generic.private.min)} – {formatINR(preview.generic.private.max)} ·{' '}
                      {preview.generic.asOf}
                    </p>
                  )}
                  <p className="italic">{t('costPreviewGenericNote')}</p>
                </>
              )}
              {preview.coverageNote && (
                <p className="font-semibold text-amber-900">{pick(preview.coverageNote, lang)}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
