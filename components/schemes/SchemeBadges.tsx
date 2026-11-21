'use client';

import { useState } from 'react';
import { BadgeCheck, ChevronDown, ExternalLink, HelpCircle, MinusCircle, ShieldAlert } from 'lucide-react';
import type { SchemeStatus } from '@/data/schemes';
import { useLang, type DictKey } from '@/lib/i18n';
import type { SchemeBadgeData } from '@/lib/schemes';


const STATUS_KEY: Record<SchemeStatus, DictKey> = {
  verified_empanelled: 'schemeStatusVerifiedEmpanelled',
  verified_not_empanelled: 'schemeStatusVerifiedNot',
  unverified: 'schemeStatusUnverified',
};

const STATUS_STYLE: Record<SchemeStatus, string> = {
  verified_empanelled: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  verified_not_empanelled: 'border-slate-300 bg-slate-100 text-slate-800',
  unverified: 'border-amber-300 bg-amber-50 text-amber-950',
};

function StatusIcon({ status }: { status: SchemeStatus }) {
  if (status === 'verified_empanelled') return <BadgeCheck size={11} aria-hidden="true" />;
  if (status === 'verified_not_empanelled') return <MinusCircle size={11} aria-hidden="true" />;
  return <HelpCircle size={11} aria-hidden="true" />;
}

/**
 * Compact per-scheme badges for a hospital CARD.
 *
 * Every badge states the scheme and its evidence status — never a bare claim.
 * "Ayushman card accepted here" is deliberately NOT used on cards: PM-JAY is
 * shown as "PM-JAY · Verified empanelled", and the acceptance sentence plus the
 * coverage caveat live on the detail page where there is room to explain them.
 */
export function SchemeBadgesCompact({ items, max = 3 }: { items: SchemeBadgeData[]; max?: number }) {
  const { t } = useLang();
  if (!items.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="scheme-badges-compact" aria-label={t('schemesCardTitle')}>
      {items.slice(0, max).map((item) => (
        <li key={item.scheme}>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[item.status]}`}
            title={`${item.short}: ${t(STATUS_KEY[item.status])}${item.stale ? ` — ${t('schemeStaleWarning')}` : ''}`}
            data-scheme={item.scheme}
            data-status={item.status}
          >
            <StatusIcon status={item.status} />
            <span className="font-extrabold">{item.short}</span>
            <span aria-hidden="true">·</span>
            <span>{t(STATUS_KEY[item.status])}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Full scheme section for the DETAIL page: status, official source, record id,
 * dates, evidence and the "empanelment is not coverage" caveat, plus a
 * report-incorrect-badge link.
 */
export default function SchemeSection({
  items,
  hospitalName,
  ayushmanAccepted,
}: {
  items: SchemeBadgeData[];
  hospitalName: string;
  ayushmanAccepted: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState<string | null>(null);
  const reportHref = `mailto:hello@jeevansetu.in?subject=${encodeURIComponent(
    `Incorrect scheme badge: ${hospitalName}`,
  )}&body=${encodeURIComponent(`Hospital: ${hospitalName}\nScheme: \nWhat looks wrong: \nOfficial source you checked: \n`)}`;

  return (
    <section aria-labelledby="schemes-heading" className="card p-5 sm:p-6" data-testid="scheme-section">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="schemes-heading" className="flex items-center gap-2 font-extrabold text-lg text-slate-900">
          <ShieldAlert className="text-brand-700" size={20} />
          {t('schemesTitle')}
        </h2>
        {ayushmanAccepted && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-900"
            data-testid="ayushman-accepted"
          >
            <BadgeCheck size={13} /> {t('schemeAyushmanAccepted')}
          </span>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => {
          const expanded = open === item.scheme;
          return (
            <li key={item.scheme} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{item.short}</p>
                  {item.lastCheckedOn && item.status !== 'unverified' && (
                    <p className="text-[10px] text-slate-500">
                      {t('schemeVerifiedOn', { date: item.lastCheckedOn })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${STATUS_STYLE[item.status]}`}
                    data-status={item.status}
                  >
                    <StatusIcon status={item.status} />
                    {t(STATUS_KEY[item.status])}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : item.scheme)}
                    aria-expanded={expanded}
                    className="inline-flex min-h-[32px] items-center gap-1 text-[11px] font-bold text-brand-800 underline underline-offset-2"
                  >
                    {expanded ? t('schemeCollapse') : t('schemeExpand')}
                    <ChevronDown size={13} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-slate-100 px-3 py-2.5 text-[11px] leading-relaxed text-slate-700">
                  <p className="font-semibold text-slate-800">{item.label}</p>
                  {item.stale && <p className="mt-1 font-semibold text-amber-900">{t('schemeStaleWarning')}</p>}
                  {item.status === 'unverified' && <p className="mt-1">{t('schemeUnverifiedWhy')}</p>}
                  {item.evidenceNote && (
                    <p className="mt-1.5">
                      <strong>{t('schemeEvidence')}:</strong> {item.evidenceNote}
                    </p>
                  )}
                  <dl className="mt-1.5 grid gap-x-3 gap-y-0.5 sm:grid-cols-2">
                    {item.authority && (
                      <div className="flex gap-1">
                        <dt className="font-semibold text-slate-500">{t('schemeSourceLabel')}:</dt>
                        <dd className="min-w-0 break-words">{item.authority}</dd>
                      </div>
                    )}
                    {item.officialRecordId && (
                      <div className="flex gap-1">
                        <dt className="font-semibold text-slate-500">{t('schemeRecordId')}:</dt>
                        <dd>{item.officialRecordId}</dd>
                      </div>
                    )}
                    {item.effectiveOn && (
                      <div className="flex gap-1">
                        <dt className="font-semibold text-slate-500">{t('schemeEffectiveOn')}:</dt>
                        <dd>{item.effectiveOn}</dd>
                      </div>
                    )}
                    {item.validityNote && (
                      <div className="flex gap-1 sm:col-span-2">
                        <dt className="font-semibold text-slate-500">{t('schemeValidity')}:</dt>
                        <dd>{item.validityNote}</dd>
                      </div>
                    )}
                    {item.sourceUrl && (
                      <div className="flex gap-1 sm:col-span-2">
                        <dt className="font-semibold text-slate-500">{t('schemeSourceUrl')}:</dt>
                        <dd className="min-w-0 break-all" data-testid="scheme-source-url">
                          {item.sourceUrl}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {item.caveat && (
                    <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-amber-950">
                      <strong>{t('schemeCaveat')}:</strong> {item.caveat}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {(item.sourceUrl || item.lookupUrl) && (
                      <a
                        href={item.sourceUrl ?? item.lookupUrl ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-brand-800 underline underline-offset-2"
                      >
                        {t('schemeCheckOfficial')} <ExternalLink size={11} />
                      </a>
                    )}
                    <a href={reportHref} className="font-bold text-brand-800 underline underline-offset-2">
                      {t('schemeReportWrong')}
                    </a>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
        {t('schemeNotGuarantee')}
      </p>
      <p className="mt-1.5 text-[10px] text-slate-500">{t('schemeGroupWarning')}</p>
      <a href={reportHref} className="mt-2 inline-block text-[11px] font-bold text-brand-800 underline">
        {t('schemeReportWrong')}
      </a>
    </section>
  );
}
