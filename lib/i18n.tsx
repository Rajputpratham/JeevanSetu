'use client';
/**
 * JeevanSetu language support — English (en) and Hindi (hi).
 * Translations cover the persistent chrome (header, emergency strip, hero,
 * primary actions, footer) plus common hospital-card actions. Long-form
 * page body text remains English in this release; untranslated keys fall
 * back to English automatically.
 */
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

export type Lang = 'en' | 'hi';

const en = {
  emergencyStrip: 'Medical emergency? Call 112 now — free, 24×7, anywhere in India.',
  navEmergency112: '112',
  navHome: 'Home',
  navFind: 'Find Hospitals',
  navCompare: 'Compare',
  navCost: 'Cost Estimator',
  navEmergency: 'Emergency',
  navRecommend: 'Recommend',
  heroBadge: 'Free · No account needed · Hindi & English',
  heroTitle: 'The Right Hospital, Closer to You.',
  heroSub: 'Find nearby hospitals, understand treatment costs and make informed healthcare decisions for your family.',
  heroBtnFind: 'Find Nearby Hospitals',
  heroBtnCost: 'Estimate Treatment Cost',
  heroBtnEmergency: 'Emergency Assistance',
  heroTrust: 'No sign-up required · Works on any phone · Free to use',
  searchPlaceholder: 'Search hospital, speciality or city…',
  searchBtn: 'Search',
  useMyLocation: 'Use my location',
  callNow: 'Call Hospital',
  getDirections: 'Get Directions',
  viewDetails: 'View Details',
  addToCompare: 'Add to Compare',
  inCompare: 'In comparison ✓',
  govtBadge: 'Government',
  privateBadge: 'Private',
  verified: 'Verified',
  unverified: 'Unverified',
  unavailable: 'Not listed',
  emergencyTitle: 'Emergency Help, Fast',
  emergencySub: 'In a life-threatening emergency, call 112 first. Do not wait for this website.',
  call112: 'Call 112 Now',
  nearbyEmergency: 'Nearby hospitals with emergency services',
  costTitle: 'Approximate treatment costs',
  costBtn: 'Estimate my cost',
  sectionFeatures: 'Everything you need, in one place',
  sectionNearby: 'Hospitals near you',
  sectionRecommended: 'Recommended for your needs',
  sectionCompare: 'Compare hospitals side by side',
  sectionEmergency: 'In an emergency',
  footerAbout: 'About JeevanSetu',
  footerContact: 'Contact',
  footerLegal: 'Legal',
  footerEmergency: 'Emergency information',
  disclaimerShort: 'JeevanSetu is an information service, not medical advice. In emergencies, always call 112 first.',
};

const hi: Record<keyof typeof en, string> = {
  emergencyStrip: 'चिकित्सा आपात स्थिति? अभी 112 पर कॉल करें — मुफ़्त, 24×7, पूरे भारत में।',
  navEmergency112: '112',
  navHome: 'होम',
  navFind: 'अस्पताल खोजें',
  navCompare: 'तुलना करें',
  navCost: 'लागत अनुमान',
  navEmergency: 'आपातकाल',
  navRecommend: 'सलाह',
  heroBadge: 'मुफ़्त · खाता नहीं चाहिए · हिंदी और अंग्रेज़ी',
  heroTitle: 'सही अस्पताल, आपसे बस कुछ दूर।',
  heroSub: 'अपने परिवार के लिए नज़दीकी अस्पताल खोजें, इलाज का अनुमानित खर्च समझें और सही फ़ैसला लें।',
  heroBtnFind: 'नज़दीकी अस्पताल खोजें',
  heroBtnCost: 'इलाज का खर्च जानें',
  heroBtnEmergency: 'आपात सहायता',
  heroTrust: 'रजिस्ट्रेशन की ज़रूरत नहीं · किसी भी फ़ोन पर चलता है · पूरी तरह मुफ़्त',
  searchPlaceholder: 'अस्पताल, विशेषता या शहर खोजें…',
  searchBtn: 'खोजें',
  useMyLocation: 'मेरी लोकेशन इस्तेमाल करें',
  callNow: 'अस्पताल को कॉल करें',
  getDirections: 'दिशा-निर्देश पाएं',
  viewDetails: 'विवरण देखें',
  addToCompare: 'तुलना में जोड़ें',
  inCompare: 'तुलना में है ✓',
  govtBadge: 'सरकारी',
  privateBadge: 'निजी',
  verified: 'सत्यापित',
  unverified: 'असत्यापित',
  unavailable: 'सूची में नहीं',
  emergencyTitle: 'आपातकाल में तुरंत मदद',
  emergencySub: 'जान को ख़तरा हो तो पहले 112 पर कॉल करें। इस वेबसाइट के इंतज़ार में समय बर्बाद न करें।',
  call112: 'अभी 112 पर कॉल करें',
  nearbyEmergency: 'आपातकालीन सेवा वाले नज़दीकी अस्पताल',
  costTitle: 'इलाज का अनुमानित खर्च',
  costBtn: 'मेरा खर्च जानें',
  sectionFeatures: 'सब कुछ एक ही जगह',
  sectionNearby: 'आपके नज़दीक अस्पताल',
  sectionRecommended: 'आपकी ज़रूरत के अनुसार सलाह',
  sectionCompare: 'अस्पतालों की तुलना करें',
  sectionEmergency: 'आपातकाल में',
  footerAbout: 'JeevanSetu के बारे में',
  footerContact: 'संपर्क करें',
  footerLegal: 'कानूनी',
  footerEmergency: 'आपातकालीन जानकारी',
  disclaimerShort: 'JeevanSetu एक जानकारी सेवा है, चिकित्सा सलाह नहीं। आपात स्थिति में हमेशा पहले 112 पर कॉल करें।',
};

export const dict = { en, hi } as const;
export type DictKey = keyof typeof en;

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
}
const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {}, t: (k) => en[k] });
const STORAGE = 'jeevansetu-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE);
      if (saved === 'hi' || saved === 'en') setLangState(saved);
    } catch { /* private mode */ }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE, l);
      document.documentElement.lang = l === 'hi' ? 'hi' : 'en';
    } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: DictKey) => dict[lang][key] ?? en[key], [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}
