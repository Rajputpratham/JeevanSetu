import type { Metadata } from 'next';
import { PhoneCall, Mail, MapPin, Siren } from 'lucide-react';
import ContactForm from '@/components/contact/ContactForm';

export const metadata: Metadata = {
  title: 'Contact JeevanSetu — Report Corrections or Suggest a Hospital',
  description: 'Report incorrect hospital information, suggest a hospital to add, or collaborate with JeevanSetu. For medical emergencies call 112 — do not use this form.',
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Contact</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">Tell us what’s wrong, or what’s missing.</h1>
      <p className="mt-2 text-slate-600 max-w-2xl">A wrong phone number or a missing district hospital can cost someone precious time. Your correction matters.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5 items-start">
        <div className="lg:col-span-3"><ContactForm /></div>
        <aside className="lg:col-span-2 flex flex-col gap-4">
          <div className="card p-5">
            <h2 className="font-extrabold text-lg text-slate-900">Reach us directly</h2>
            <ul className="mt-3 space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2.5"><Mail size={17} className="mt-0.5 text-brand-700 shrink-0" /><a className="font-semibold text-brand-800 hover:underline" href="mailto:hello@jeevansetu.in">hello@jeevansetu.in</a></li>
              <li className="flex items-start gap-2.5"><MapPin size={17} className="mt-0.5 text-brand-700 shrink-0" />JeevanSetu project team<br />Serving rural &amp; low-income communities across India</li>
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">We read every message, but we cannot respond to individual medical queries — please consult a doctor or call 112.</p>
          </div>
          <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5">
            <h2 className="font-extrabold text-red-900 flex items-center gap-2"><Siren size={19} />Medical emergency?</h2>
            <p className="mt-1 text-sm text-red-900">Do not write to us — call now.</p>
            <a href="tel:112" className="mt-3 inline-flex items-center gap-2 bg-red-700 text-white font-extrabold rounded-xl px-5 py-3.5 hover:bg-red-800"><PhoneCall size={20} />Call 112</a>
          </div>
        </aside>
      </div>
    </div>
  );
}
