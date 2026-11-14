import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — JeevanSetu',
  description: 'JeevanSetu collects no personal medical data. Location and comparison choices stay in your browser. No ads, no tracking, no sale of data.',
};

const SECTIONS: { title: string; body: string[] }[] = [
  { title: 'What we collect', body: [
    'JeevanSetu has no accounts, no logins and no sign-up. We do not ask for your name, phone number, age, gender or any medical history.',
    'Your approximate location is used only to compute distances and, if you tap “Use my location”, is read directly by your browser via the standard Geolocation API. We do not receive or store it on any server.',
    'Your compare selection (the hospitals you add to the comparison) and your language preference are stored in your own browser (localStorage) only. Clearing browser storage erases them.',
  ]},
  { title: 'Third-party services we use', body: [
    'OpenStreetMap tile servers and Nominatim search — when you view the map or type a place name, your browser requests map tiles/geocoding from OpenStreetMap. Their privacy policy applies to those requests.',
    'Google Maps links — tapping “Get Directions” opens Google Maps under Google’s privacy policy. We do not send Google any data automatically.',
    'We run no advertising trackers, no analytics pixels and no social media SDKs.',
  ]},
  { title: 'What we never do', body: [
    'We never sell, rent or share personal data — we do not have any.',
    'We never build health profiles, and we never contact you (we cannot — we have no contact details).',
    'We never ask for payment for emergency assistance. 112 and government ambulance services (108/102 in most states) are free.',
  ]},
  { title: 'Your choices', body: [
    'You may use JeevanSetu entirely without sharing your location — pick your city from the quick-pick list instead.',
    'You may clear saved data anytime via your browser settings (site data / local storage).',
    'For data-protection grievances write to hello@jeevansetu.in.',
  ]},
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Legal</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: November 2026 · Applies to jeevansetu.in and all JeevanSetu services.</p>
      {SECTIONS.map(({ title, body }) => (
        <section key={title} className="mt-7">
          <h2 className="font-extrabold text-xl text-slate-900">{title}</h2>
          <ul className="mt-2 list-disc list-inside space-y-1.5 text-[15px] text-slate-700 leading-relaxed">
            {body.map((line) => <li key={line.slice(0, 40)}>{line}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
