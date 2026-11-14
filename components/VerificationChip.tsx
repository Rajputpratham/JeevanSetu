'use client';
import { CheckCircle2, HelpCircle, MinusCircle } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export default function VerificationChip({ status }: { status: 'verified' | 'unverified' | 'unavailable' }) {
  const { t } = useLang();
  if (status === 'verified')
    return <span className="chip !bg-green-50 !border-green-200 !text-green-800"><CheckCircle2 size={12} strokeWidth={2.5} />{t('verified')}</span>;
  if (status === 'unverified')
    return <span className="chip-amber"><HelpCircle size={12} strokeWidth={2.5} />{t('unverified')}</span>;
  return <span className="chip-grey"><MinusCircle size={12} strokeWidth={2.5} />{t('unavailable')}</span>;
}
