import { CheckCircle2, HelpCircle, MinusCircle } from 'lucide-react';

export default function VerificationChip({ status }: { status: 'verified' | 'unverified' | 'unavailable' }) {
  if (status === 'verified')
    return <span className="chip !bg-green-50 !border-green-200 !text-green-800"><CheckCircle2 size={12} strokeWidth={2.5} />Verified</span>;
  if (status === 'unverified')
    return <span className="chip-amber"><HelpCircle size={12} strokeWidth={2.5} />Unverified</span>;
  return <span className="chip-grey"><MinusCircle size={12} strokeWidth={2.5} />Not listed</span>;
}
