import Link from 'next/link';

export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="JeevanSetu — home">
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="JeevanSetu logo">
        <circle cx="24" cy="24" r="22" fill="#1f7453" />
        <path d="M24 35s-9.2-6.1-13.3-11.6c-2.8-3.7-2-8.9 1.9-11.3 3-1.9 6.7-.8 8.9 2.1l2.5 3 2.5-3c2.2-2.9 5.9-4 8.9-2.1 3.9 2.4 4.7 7.6 1.9 11.3C33.2 28.9 24 35 24 35z" fill="#fff" opacity="0.96"/>
        <path d="M10.5 24.5h6l2.2-4.5 3.1 8 2.4-5.5 1.6 2h11.7" fill="none" stroke="#1f7453" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="leading-tight">
        <span className="block text-xl font-extrabold tracking-tight text-brand-800">Jeevan<span className="text-brand-600">Setu</span></span>
        <span className="hidden sm:block text-[10px] font-medium uppercase tracking-widest text-slate-500">Connecting people to healthcare</span>
      </span>
    </Link>
  );
}
