'use client';
import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';

const TOPICS = ['Report incorrect hospital information', 'Suggest a hospital to add', 'Cost data feedback', 'Partnership / NGO collaboration', 'Other'];

export default function ContactForm() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 10) {
      setError('Please describe the issue in at least 10 characters so we can act on it.');
      return;
    }
    const subject = encodeURIComponent(`[JeevanSetu] ${topic}`);
    const body = encodeURIComponent(`Name: ${name.trim() || '(not provided)'}\nTopic: ${topic}\n\n${message.trim()}\n\n— sent via jeevansetu.in/contact`);
    window.location.href = `mailto:hello@jeevansetu.in?subject=${subject}&body=${body}`;
  };

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6 flex flex-col gap-4" aria-label="Contact form">
      <div>
        <label htmlFor="c-topic" className="label">What is this about?</label>
        <select id="c-topic" className="input appearance-none" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="c-name" className="label">Your name <span className="font-normal text-slate-400">(optional)</span></label>
        <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar, ASHA worker, Patna" autoComplete="name" />
      </div>
      <div>
        <label htmlFor="c-msg" className="label">Details <span aria-hidden="true" className="text-red-700">*</span></label>
        <textarea id="c-msg" className="input min-h-[120px]" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} placeholder="Hospital name, city, what is wrong, and the correct information if you know it…" />
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <button type="submit" className="btn-primary"><Send size={18} /> Open in your email app</button>
      <p className="text-[11px] text-slate-500">Submitting opens your email app with a pre-filled message to hello@jeevansetu.in — nothing is stored on our servers. For medical emergencies call <a href="tel:112" className="font-bold text-red-700">112</a> instead.</p>
    </form>
  );
}
