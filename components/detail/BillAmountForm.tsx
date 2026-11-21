'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { TREATMENTS } from '@/data/treatments';
import { useLang } from '@/lib/i18n';
import { tTreatmentCategory } from '@/lib/i18n-data';
import { formatINR } from '@/lib/format';
import type { PublicBillObservation } from '@/lib/review-bills';

const CATEGORIES = Array.from(new Set(TREATMENTS.map((t) => t.category)));
const MAX_FILE_BYTES = 3 * 1024 * 1024;

function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push({
      value,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    });
  }
  return out;
}

/**
 * "What did you actually pay?" — optional bill amount with optional PRIVATE bill
 * evidence.
 *
 * The file is read in the browser, base64-encoded and POSTed once; it is never
 * given a public URL and no download link exists. The status starts as
 * `self_reported` (no file) or `pending_verification` (file) and can only become
 * `bill_verified` through the reviewer endpoint.
 */
export default function BillAmountForm({
  hospitalId,
  onSubmitted,
}: {
  hospitalId: string;
  onSubmitted?: (bill: PublicBillObservation) => void;
}) {
  const { t, lang } = useLang();
  const months = monthOptions();
  const [treatmentId, setTreatmentId] = useState('normal-delivery');
  const [careMonth, setCareMonth] = useState(months[0].value);
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState<'total_bill' | 'hospital_charges_only' | 'out_of_pocket_after_scheme' | 'not_sure'>('total_bill');
  const [schemeUsed, setSchemeUsed] = useState('not_sure');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<{ name: string; mimeType: string; base64: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PublicBillObservation | null>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setError(lang === 'hi' ? 'फ़ाइल 3 MB से छोटी होनी चाहिए।' : 'The file must be 3 MB or smaller.');
      setFile(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(picked.type)) {
      setError(lang === 'hi' ? 'JPG, PNG, WebP या PDF चुनें।' : 'Choose a JPG, PNG, WebP image or a PDF.');
      setFile(null);
      return;
    }
    const buffer = await picked.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    setFile({ name: picked.name, mimeType: picked.type, base64: btoa(binary) });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!consent) {
      setError(t('billPrivacyConsentRequired'));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId,
          treatmentId,
          careMonth,
          amountInr: Number(amount),
          scope,
          schemeUsed,
          note,
          consent,
          file,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not submit the amount.');
        return;
      }
      setDone(data.bill);
      onSubmitted?.(data.bill);
      setAmount('');
      setNote('');
      setFile(null);
      setConsent(false);
    } catch {
      setError(lang === 'hi' ? 'नेटवर्क त्रुटि। दोबारा प्रयास करें।' : 'Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3" data-testid="bill-submitted">
        <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-900">
          <CheckCircle2 size={16} /> {t('billThankYou')}
        </p>
        <p className="mt-1 text-xs text-emerald-900">
          {formatINR(done.amountInr)} · {done.careMonth} ·{' '}
          {done.verificationStatus === 'pending_verification' ? t('billStatusPending') : t('billStatusSelfReported')}
        </p>
        <p className="mt-1 text-[11px] text-emerald-900/80">{t('billPrivacyNote')}</p>
        <button type="button" className="mt-2 text-xs font-bold text-emerald-900 underline" onClick={() => setDone(null)}>
          {lang === 'hi' ? 'एक और राशि साझा करें' : 'Share another amount'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border-2 border-slate-200 bg-white p-4" data-testid="bill-form">
      <h3 className="text-sm font-extrabold text-slate-900">{t('billFormTitle')}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{t('billFormHint')}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="bill-treatment" className="label !text-xs">{t('billTreatmentLabel')}</label>
          <select
            id="bill-treatment"
            value={treatmentId}
            onChange={(e) => setTreatmentId(e.target.value)}
            className="input !py-2 !text-sm !min-h-[42px]"
            required
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

        <div>
          <label htmlFor="bill-amount" className="label !text-xs">{t('billAmountLabel')}</label>
          <input
            id="bill-amount"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000000}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('billAmountPlaceholder')}
            className="input !py-2 !text-sm !min-h-[42px]"
          />
        </div>

        <div>
          <label htmlFor="bill-month" className="label !text-xs">{t('billMonthLabel')}</label>
          <select
            id="bill-month"
            value={careMonth}
            onChange={(e) => setCareMonth(e.target.value)}
            className="input !py-2 !text-sm !min-h-[42px]"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="bill-scope" className="label !text-xs">{t('billScopeLabel')}</label>
          <select
            id="bill-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            className="input !py-2 !text-sm !min-h-[42px]"
          >
            <option value="total_bill">{t('billScopeTotal')}</option>
            <option value="hospital_charges_only">{t('billScopeHospitalOnly')}</option>
            <option value="out_of_pocket_after_scheme">{t('billScopeOutOfPocket')}</option>
            <option value="not_sure">{t('billScopeNotSure')}</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="bill-scheme" className="label !text-xs">{t('billSchemeLabel')}</label>
          <select
            id="bill-scheme"
            value={schemeUsed}
            onChange={(e) => setSchemeUsed(e.target.value)}
            className="input !py-2 !text-sm !min-h-[42px]"
          >
            <option value="not_sure">{t('billSchemeNotSure')}</option>
            <option value="none">{t('billSchemeNone')}</option>
            <option value="pmjay">PM-JAY</option>
            <option value="cghs">CGHS</option>
            <option value="delhi-arogya-kosh">{t('schemeDak')}</option>
            <option value="haryana-chirayu">{t('schemeHaryana')}</option>
            <option value="esic">ESIC</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="bill-note" className="label !text-xs">{t('billNoteLabel')}</label>
          <input
            id="bill-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={400}
            placeholder={t('billNotePlaceholder')}
            className="input !py-2 !text-sm !min-h-[42px]"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="bill-file" className="label !text-xs">{t('billUploadLabel')}</label>
          <input
            id="bill-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={onFile}
            className="block w-full text-xs text-slate-700 file:mr-2 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
            aria-describedby="bill-upload-hint"
          />
          <p id="bill-upload-hint" className="mt-1 flex items-start gap-1 text-[11px] text-amber-900">
            <Lock size={12} className="mt-0.5 shrink-0" /> {t('billUploadHint')}
          </p>
        </div>
      </div>

      <label className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-700">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
          required
        />
        <span>{t('billConsentLabel')}</span>
      </label>
      <p className="mt-1 text-[10px] text-slate-500">{t('billPrivacyNote')}</p>

      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary mt-3 !py-2.5 !text-sm">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {t('billSubmit')}
      </button>
    </form>
  );
}
