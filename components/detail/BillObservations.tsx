'use client';

import { Info, Lock, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { formatINR } from '@/lib/format';
import type { BillVerificationStatus, PublicBillObservation } from '@/lib/review-bills';

const STATUS_KEY: Record<BillVerificationStatus, 'billStatusSelfReported' | 'billStatusPending' | 'billStatusVerified' | 'billStatusRejected'> = {
  self_reported: 'billStatusSelfReported',
  pending_verification: 'billStatusPending',
  bill_verified: 'billStatusVerified',
  rejected_removed: 'billStatusRejected',
};

const STATUS_WHY = {
  self_reported: 'billStatusSelfReportedWhy',
  pending_verification: 'billStatusPendingWhy',
  bill_verified: 'billStatusVerifiedWhy',
  rejected_removed: 'billStatusRejectedWhy',
} as const;

const SCOPE_KEY = {
  total_bill: 'billScopeTotal',
  hospital_charges_only: 'billScopeHospitalOnly',
  out_of_pocket_after_scheme: 'billScopeOutOfPocket',
  not_sure: 'billScopeNotSure',
} as const;

function StatusChip({ status }: { status: BillVerificationStatus }) {
  const { t } = useLang();
  const style =
    status === 'bill_verified'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : status === 'pending_verification'
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : status === 'rejected_removed'
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-slate-300 bg-slate-100 text-slate-800';
  const Icon = status === 'bill_verified' ? ShieldCheck : status === 'pending_verification' ? ShieldQuestion : Info;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${style}`} data-status={status}>
      <Icon size={10} aria-hidden="true" /> {t(STATUS_KEY[status])}
    </span>
  );
}

/**
 * Public list of reported bill amounts for this branch.
 *
 * Shows only: amount, treatment, approximate month, coverage scope, moderated
 * note (already redacted server-side) and the verification label. Never shows the
 * uploaded file, its name, or any identity. States explicitly that these are
 * individual observations, not a tariff or a typical price.
 */
export default function BillObservations({
  bills,
  loading,
}: {
  bills: PublicBillObservation[];
  loading: boolean;
}) {
  const { t, lang } = useLang();

  if (loading) {
    return <p className="mt-3 text-xs text-slate-500">{lang === 'hi' ? 'बिल अवलोकन लोड हो रहे हैं…' : 'Loading bill observations…'}</p>;
  }

  return (
    <section className="mt-4" aria-labelledby="bills-heading" data-testid="bill-observations">
      <h3 id="bills-heading" className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
        {t('billCountLabel', { count: bills.length })}
      </h3>
      {bills.length === 0 ? (
        <p className="mt-1 text-xs text-slate-600">{t('billNoObservations')}</p>
      ) : (
        <>
          <ul className="mt-2 space-y-2">
            {bills.slice(0, 8).map((bill) => (
              <li key={bill.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-slate-900">{formatINR(bill.amountInr)}</span>
                  <StatusChip status={bill.verificationStatus} />
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  {bill.careMonth} · {t(SCOPE_KEY[bill.coverage.scope])}
                </p>
                {bill.note && <p className="mt-1 text-[11px] text-slate-700">“{bill.note}”</p>}
                <p className="mt-1 text-[10px] text-slate-500">{t(STATUS_WHY[bill.verificationStatus])}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-start gap-1 text-[10px] text-slate-500">
            <Info size={11} className="mt-0.5 shrink-0" /> {t('billNotTypical')}
          </p>
        </>
      )}
      <p className="mt-1 flex items-start gap-1 text-[10px] text-slate-500">
        <Lock size={11} className="mt-0.5 shrink-0" /> {t('billPrivacyNote')}
      </p>
      <p className="mt-1 text-[10px] text-slate-500">
        {t('billCorrectionNote', { email: 'hello@jeevansetu.in' })}
      </p>
    </section>
  );
}
