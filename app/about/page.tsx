import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { HeartPulse, MapPin, Calculator, Siren, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About JeevanSetu — Why We Built a Free Healthcare Bridge',
  description: 'JeevanSetu mission: make healthcare information accessible to rural, low-income Indians. How our data is sourced, verified and labelled — and what we will never do.',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">About us</p>
      <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight text-brand-950 leading-[1.1]">A bridge between rural families and the care they deserve.</h1>
      <p className="mt-4 text-lg text-slate-700 max-w-3xl">“Jeevan” means life; “Setu” means bridge. JeevanSetu exists because finding the right hospital in rural India should not depend on who you know.</p>

      <Image src="/images/health-camp.jpg" alt="A community health check-up camp in an Indian village courtyard" width={1200} height={560} className="mt-8 w-full h-52 sm:h-72 object-cover rounded-3xl border border-brand-100" />

      <div className="mt-10 grid sm:grid-cols-2 gap-4">
        {[
          { icon: MapPin, title: 'Find', body: 'We map government and private hospitals — AIIMS to district hospitals — with distance, contact and one-tap directions.' },
          { icon: HeartPulse, title: 'Understand', body: 'PLAIN language: what the hospital does, what it costs (indicative ₹ ranges), and what we could not verify.' },
          { icon: Calculator, title: 'Decide', body: 'Side-by-side comparison and budget-aware recommendations so the cheapest safe option is visible to every family.' },
          { icon: Siren, title: 'Reach help fast', body: 'Verified 24×7 emergency hospitals and India’s 112 national emergency number, one tap away, everywhere on the site.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="card p-5">
            <Icon className="text-brand-700" size={26} aria-hidden="true" />
            <h2 className="mt-2 font-extrabold text-lg text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      <section className="mt-10" aria-labelledby="how">
        <h2 id="how" className="section-title !text-2xl">How we handle data — our promises</h2>
        <ul className="mt-4 space-y-3 text-slate-700">
          {[
            'Every fact carries a status: Verified, Unverified or Not listed. We never paste an invented phone number, rating, bed count or doctor name into the site.',
            'Hospital contact numbers come from public listings (hospital websites, government directories). They can change — always confirm by phone before an emergency visit.',
            'Cost figures are indicative ranges from public CGHS / PM-JAY / state-scheme and published tariff references — see our Disclaimer page for exact sourcing notes.',
            'We collect no personal medical data, run no ads and sell nothing. Compare selections and your location stay in your own browser (localStorage).',
            'JeevanSetu is decision support, not medical advice. For diagnosis and treatment, consult a qualified doctor. In emergencies, call 112.',
          ].map((p) => (
            <li key={p} className="flex items-start gap-2.5"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-700" />{p}</li>
          ))}
        </ul>
      </section>

      <div className="mt-10 card p-6 text-center bg-brand-50">
        <h2 className="font-extrabold text-xl text-brand-950">Help us get the data right</h2>
        <p className="mt-1 text-sm text-slate-600 max-w-xl mx-auto">ASHA workers, nurses, doctors and patients — if a listing is wrong or a hospital is missing, tell us. Corrections keep families safe.</p>
        <Link href="/contact" className="btn-primary mt-4">Report a correction →</Link>
      </div>
    </div>
  );
}
