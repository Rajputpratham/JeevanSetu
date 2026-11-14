/**
 * JeevanSetu supported languages — 10 Indian languages + English (11 total).
 * Includes script metadata, SpeechRecognition BCP-47 locale, and text direction.
 */
export type Lang =
  | 'en' // English
  | 'hi' // Hindi (हिन्दी)
  | 'bn' // Bengali (বাংলা)
  | 'te' // Telugu (తెలుగు)
  | 'mr' // Marathi (मराठी)
  | 'ta' // Tamil (தமிழ்)
  | 'gu' // Gujarati (ગુજરાતી)
  | 'ur' // Urdu (اردو) — RTL
  | 'kn' // Kannada (ಕನ್ನಡ)
  | 'or' // Odia (ଓଡ଼ିଆ)
  | 'ml'; // Malayalam (മലയാളം)

export interface LanguageMeta {
  code: Lang;
  name: string;
  nativeName: string;
  shortLabel: string;
  dir: 'ltr' | 'rtl';
  speechLocale: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English', shortLabel: 'EN', dir: 'ltr', speechLocale: 'en-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', shortLabel: 'हिं', dir: 'ltr', speechLocale: 'hi-IN' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', shortLabel: 'বাং', dir: 'ltr', speechLocale: 'bn-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', shortLabel: 'తె', dir: 'ltr', speechLocale: 'te-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', shortLabel: 'मरा', dir: 'ltr', speechLocale: 'mr-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', shortLabel: 'தமி', dir: 'ltr', speechLocale: 'ta-IN' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', shortLabel: 'ગુજ', dir: 'ltr', speechLocale: 'gu-IN' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', shortLabel: 'اردو', dir: 'rtl', speechLocale: 'ur-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', shortLabel: 'ಕನ್ನ', dir: 'ltr', speechLocale: 'kn-IN' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', shortLabel: 'ଓଡ଼ି', dir: 'ltr', speechLocale: 'or-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', shortLabel: 'മല', dir: 'ltr', speechLocale: 'ml-IN' },
];

export const VALID_LANGS = new Set<Lang>(SUPPORTED_LANGUAGES.map((l) => l.code));

export function isValidLang(val: unknown): val is Lang {
  return typeof val === 'string' && VALID_LANGS.has(val as Lang);
}

export function getLangMeta(lang: Lang): LanguageMeta {
  return SUPPORTED_LANGUAGES.find((l) => l.code === lang) ?? SUPPORTED_LANGUAGES[0];
}

export const DISTANCE_UNITS: Record<Lang, { m: string; km: string; min: string; hr: string; unknown: string }> = {
  en: { m: 'm', km: 'km', min: 'min', hr: 'hr', unknown: 'Distance unknown' },
  hi: { m: 'मी', km: 'किमी', min: 'मिनट', hr: 'घंटा', unknown: 'दूरी अज्ञात' },
  bn: { m: 'মি', km: 'কিমি', min: 'মিনিট', hr: 'ঘণ্টা', unknown: 'দূরত্ব অজানা' },
  te: { m: 'మీ', km: 'కి.మీ', min: 'నిమి', hr: 'గం', unknown: 'దూరం తెలియదు' },
  mr: { m: 'मी', km: 'किमी', min: 'मिनिटे', hr: 'तास', unknown: 'अंतर अज्ञात' },
  ta: { m: 'மீ', km: 'கி.மீ', min: 'நிமி', hr: 'மணி', unknown: 'தூரம் தெரியவில்லை' },
  gu: { m: 'મી', km: 'કિમી', min: 'મિનિટ', hr: 'કલાક', unknown: 'અંતર અજ્ઞાત' },
  ur: { m: 'میٹر', km: 'کلومیٹر', min: 'منٹ', hr: 'گھنٹہ', unknown: 'فاصلہ نامعلوم' },
  kn: { m: 'ಮೀ', km: 'ಕಿ.ಮೀ', min: 'ನಿಮಿಷ', hr: 'ಗಂಟೆ', unknown: 'ದೂರ ತಿಳಿದಿಲ್ಲ' },
  or: { m: 'ମି', km: 'କି.ମି.', min: 'ମିନିଟ୍', hr: 'ଘଣ୍ଟା', unknown: 'ଦୂରତା ଅଜଣା' },
  ml: { m: 'മീ', km: 'കി.മീ', min: 'മിനിറ്റ്', hr: 'മണിക്കൂർ', unknown: 'ദൂരം ലഭ്യമല്ല' },
};
