'use client';
import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';
import { useLang, DictKey } from '@/lib/i18n';

const TOPIC_KEYS: DictKey[] = ['contactTopic1', 'contactTopic2', 'contactTopic3', 'contactTopic4', 'contactTopic5'];

export default function ContactForm() {
  const { t, lang } = useLang();
  const [topicKey, setTopicKey] = useState<DictKey>(TOPIC_KEYS[0]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const [draft,setDraft] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDraft(false);
    setError(false);
    if (message.trim().length < 10) {
      setError(true);
      return;
    }
    const topicLabel = t(topicKey);
    const subject = encodeURIComponent(`[JeevanSetu] ${topicLabel}`);
    const body = encodeURIComponent(`Name: ${name.trim() || '(not provided)'}\nTopic: ${topicLabel}\n\n${message.trim()}\n\n— drafted via jeevansetu.in/contact`);
    setDraft(true);
    window.location.href = `mailto:hello@jeevansetu.in?subject=${subject}&body=${body}`;
  };

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6 flex flex-col gap-4" aria-label={t('contactFormAria')}>
      <div>
        <label htmlFor="c-topic" className="label">{t('contactTopicLabel')}</label>
        <select id="c-topic" className="input appearance-none" value={topicKey} onChange={(e) => setTopicKey(e.target.value as DictKey)}>
          {TOPIC_KEYS.map((k) => <option key={k} value={k}>{t(k)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="c-name" className="label">{t('contactNameLabel')} <span className="font-normal text-slate-400">{t('optionalParen')}</span></label>
        <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('contactNamePlaceholder')} autoComplete="name" />
      </div>
      <div>
        <label htmlFor="c-msg" className="label">{t('contactDetailsLabel')} <span aria-hidden="true" className="text-red-700">*</span></label>
        <textarea id="c-msg" className="input min-h-[120px]" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} placeholder={t('contactDetailsPlaceholder')} />
      </div>
      {draft && <p role="status" className="text-sm text-brand-900">{lang === "hi" ? "ईमेल ऐप में ड्राफ्ट खोलने का अनुरोध किया गया। संदेश भेजने के लिए वहाँ भेजें चुनें।" : "Email draft requested, not sent. If your email app opened, review and send the draft there."}</p>}
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{t('contactMinLengthError')}</p>}
      <button type="submit" className="btn-primary"><Send size={18} /> {t('contactSubmitBtn')}</button>
      <p className="text-[11px] text-slate-500">
        {t('contactFootnotePre')}
        <a href="tel:112" className="font-bold text-red-700">112</a>
        {t('contactFootnotePost')}
      </p>
    </form>
  );
}
