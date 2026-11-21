import type { Lang } from './lang-meta';

/**
 * Strings for the modules added in this upgrade (verified driving distance,
 * precise location, JeevanSetu AI Assistant).
 *
 * Kept in their own typed dictionary so a half-translated key can never silently
 * produce `undefined` in the UI: every language is resolved as
 * `{ ...EN, ...OVERRIDES[lang] }`, and any key we have not professionally
 * reviewed falls back to English on purpose (honest fallback > machine-garbled
 * medical wording).
 */

export interface DistanceStrings {
  drivingDistance: string;
  straightLine: string;
  distanceUnavailable: string;
  distanceUnavailableWhy: string;
  /** Shown in place of the orange fallback when the user has not shared a location yet. */
  enableLocationDistance: string;
  eta: string;
  etaShort: string;
  trafficImpact: string;
  noLiveTraffic: string;
  lastUpdated: string;
  navigateGmaps: string;
  alternatives: string;
  via: string;
  verifiedCoords: string;
  approxCoords: string;
  sourceGoogle: string;
  sameRouteNote: string;
  /** Key-free OSRM routing (no live traffic). */
  routeUnavailableTitle: string;
  routeUnavailableWhy: string;
  estimatedDriveTime: string;
  liveTraffic: string;
  noLiveTrafficNote: string;
  providerOsrm: string;
  providerGoogle: string;
  enableLocationCta: string;
  enableLocationExplainer: string;
  deniedCompact: string;
  timeoutCompact: string;
  insecureCompact: string;
  getDirections: string;
  straightLineOnlyNote: string;
}

export interface LocationStrings {
  usePrecise: string;
  retry: string;
  change: string;
  selectOnMap: string;
  searchAddress: string;
  searchPincode: string;
  locating: string;
  accuracy: string;
  lowAccuracy: string;
  follow: string;
  startFollow: string;
  stopFollow: string;
  notSet: string;
  notSetWhy: string;
  denied: string;
  consentNote: string;
  orPickCity: string;
  refreshRoutes: string;
  coordsOnly: string;
  /** Short label meaning "the origin you set"; used in provenance lines. */
  yourLocation: string;
}

export interface AssistantStrings {
  title: string;
  subtitle: string;
  statusReady: string;
  statusListening: string;
  statusThinking: string;
  statusSpeaking: string;
  statusConnecting: string;
  mic: string;
  keyboard: string;
  speaker: string;
  end: string;
  mute: string;
  close: string;
  send: string;
  placeholder: string;
  chipFind: string;
  chipCompare: string;
  chipTravel: string;
  chipHealth: string;
  disclaimer: string;
  voiceUnsupported: string;
  transcript: string;
  poweredBy: string;
  newChat: string;
  emergencyBanner: string;
}

const DISTANCE_EN: DistanceStrings = {
  drivingDistance: 'Driving distance',
  straightLine: 'Approximate straight-line distance',
  distanceUnavailable: 'Driving distance unavailable',
  distanceUnavailableWhy: 'Live Google route data could not be loaded, so no road distance is shown.',
  enableLocationDistance: 'Enable location to see driving distance.',
  eta: 'Estimated arrival time',
  etaShort: 'min',
  trafficImpact: 'Traffic impact',
  noLiveTraffic: 'Live traffic not returned',
  lastUpdated: 'Last updated',
  navigateGmaps: 'Navigate with Google Maps',
  alternatives: 'Alternative routes',
  via: 'via',
  verifiedCoords: 'Verified hospital location',
  approxCoords: 'Approximate hospital location — verify the entrance before travelling',
  sourceGoogle: 'Google Routes API',
  sameRouteNote: 'Distance and ETA come from the same selected route.',
  routeUnavailableTitle: 'Road route unavailable',
  routeUnavailableWhy: 'No road route could be computed right now, so no road distance or drive time is shown.',
  estimatedDriveTime: 'Estimated drive time',
  liveTraffic: 'Live traffic',
  noLiveTrafficNote: 'Live traffic is not available from this routing provider. This is an estimate without traffic.',
  providerOsrm: 'Estimated with OSRM · © OpenStreetMap contributors',
  providerGoogle: 'Google Routes API',
  enableLocationCta: 'Use my location',
  enableLocationExplainer:
    'Your browser will ask for permission. You can also type a city or pincode — JeevanSetu never guesses where you are.',
  deniedCompact: 'Location permission denied. Pick a city or pincode to see the road distance.',
  timeoutCompact: 'Location request timed out. Try again or pick a city or pincode.',
  insecureCompact: 'Location needs an HTTPS connection. Pick a city or pincode instead.',
  getDirections: 'Get directions',
  straightLineOnlyNote: 'Shown for context only — this is not a driving distance and no drive time is derived from it.',
};

const DISTANCE_HI: DistanceStrings = {
  drivingDistance: 'सड़क दूरी',
  straightLine: 'अनुमानित सीधी दूरी',
  distanceUnavailable: 'सड़क दूरी उपलब्ध नहीं',
  distanceUnavailableWhy: 'Google रूट डेटा लोड नहीं हो सका, इसलिए कोई सड़क दूरी नहीं दिखाई गई है।',
  enableLocationDistance: 'सड़क दूरी देखने के लिए स्थान सक्षम करें।',
  eta: 'अनुमानित पहुंचने का समय',
  etaShort: 'मिनट',
  trafficImpact: 'ट्रैफ़िक प्रभाव',
  noLiveTraffic: 'लाइव ट्रैफ़िक उपलब्ध नहीं',
  lastUpdated: 'अंतिम अपडेट',
  navigateGmaps: 'Google Maps से नेविगेट करें',
  alternatives: 'वैकल्पिक मार्ग',
  via: 'होकर',
  verifiedCoords: 'सत्यापित अस्पताल स्थान',
  approxCoords: 'अनुमानित अस्पताल स्थान — जाने से पहले प्रवेश द्वार की पुष्टि करें',
  sourceGoogle: 'Google Routes API',
  sameRouteNote: 'दूरी और समय एक ही चुने गए मार्ग से लिए गए हैं।',
  routeUnavailableTitle: 'सड़क मार्ग उपलब्ध नहीं',
  routeUnavailableWhy: 'अभी कोई सड़क मार्ग नहीं निकाला जा सका, इसलिए सड़क दूरी या यात्रा समय नहीं दिखाया गया है।',
  estimatedDriveTime: 'अनुमानित यात्रा समय',
  liveTraffic: 'लाइव ट्रैफ़िक',
  noLiveTrafficNote: 'इस रूटिंग प्रदाता के पास लाइव ट्रैफ़िक डेटा नहीं है। यह बिना ट्रैफ़िक वाला अनुमान है।',
  providerOsrm: 'OSRM से अनुमानित · © OpenStreetMap योगदानकर्ता',
  providerGoogle: 'Google Routes API',
  enableLocationCta: 'मेरी लोकेशन इस्तेमाल करें',
  enableLocationExplainer:
    'आपका ब्राउज़र अनुमति मांगेगा। आप शहर या पिनकोड भी लिख सकते हैं — JeevanSetu आपकी लोकेशन का अनुमान कभी नहीं लगाता।',
  deniedCompact: 'लोकेशन अनुमति अस्वीकृत। सड़क दूरी देखने के लिए शहर या पिनकोड चुनें।',
  timeoutCompact: 'लोकेशन अनुरोध समय-सीमा पार कर गया। दोबारा प्रयास करें या शहर/पिनकोड चुनें।',
  insecureCompact: 'लोकेशन के लिए HTTPS कनेक्शन आवश्यक है। इसके बजाय शहर या पिनकोड चुनें।',
  getDirections: 'दिशा-निर्देश पाएं',
  straightLineOnlyNote: 'केवल संदर्भ के लिए — यह सड़क दूरी नहीं है और इससे यात्रा समय नहीं निकाला जाता।',
};

const LOCATION_EN: LocationStrings = {
  usePrecise: 'Use My Precise Location',
  retry: 'Retry Location',
  change: 'Change Location',
  selectOnMap: 'Select Location on Map',
  searchAddress: 'Search by Address',
  searchPincode: 'Search by PIN Code',
  locating: 'Getting your precise location…',
  accuracy: 'Accurate to about {m} m',
  lowAccuracy: 'Your device reported a large accuracy radius (±{m} m) — treat this origin as approximate.',
  follow: 'Follow my location live',
  startFollow: 'Start live following',
  stopFollow: 'Stop live following',
  notSet: 'Location not set',
  notSetWhy:
    'JeevanSetu will not guess your location, so driving distances stay hidden until you share one or pick a place.',
  denied: 'Location permission was denied — no coordinates were guessed.',
  consentNote:
    'Your coordinates are used only to calculate distances for this visit. Nothing is saved without your consent.',
  orPickCity: 'or pick a city',
  refreshRoutes: 'Recalculate routes',
  coordsOnly: 'coordinates only',
  yourLocation: 'your selected starting point',
};

const LOCATION_HI: LocationStrings = {
  usePrecise: 'मेरी सटीक लोकेशन इस्तेमाल करें',
  retry: 'लोकेशन फिर से लें',
  change: 'लोकेशन बदलें',
  selectOnMap: 'मैप पर लोकेशन चुनें',
  searchAddress: 'पते से खोजें',
  searchPincode: 'पिन कोड से खोजें',
  locating: 'आपकी सटीक लोकेशन ली जा रही है…',
  accuracy: 'लगभग {m} मीटर तक सटीक',
  lowAccuracy: 'आपके डिवाइस ने बड़ी सटीकता सीमा (±{m} मीटर) बताई है — इसे अनुमानित मानें।',
  follow: 'मेरी लोकेशन लाइव फ़ॉलो करें',
  startFollow: 'लाइव फ़ॉलोिंग शुरू करें',
  stopFollow: 'लाइव फ़ॉलोिंग बंद करें',
  notSet: 'लोकेशन सेट नहीं है',
  notSetWhy: 'JeevanSetu आपकी लोकेशन का अनुमान नहीं लगाएगा, इसलिए सड़क दूरी तब तक नहीं दिखेगी जब तक आप लोकेशन न दें।',
  denied: 'लोकेशन अनुमति अस्वीकृत — कोई निर्देशांक अनुमानित नहीं किया गया।',
  consentNote: 'आपके निर्देशांक केवल इस विज़िट की दूरी गणना के लिए उपयोग होते हैं। सहमति के बिना कुछ भी सहेजा नहीं जाता।',
  orPickCity: 'या शहर चुनें',
  refreshRoutes: 'मार्ग फिर से गणना करें',
  coordsOnly: 'केवल निर्देशांक',
  yourLocation: 'आपका चुना हुआ प्रारंभिक स्थान',
};

const ASSISTANT_EN: AssistantStrings = {
  title: 'JeevanSetu AI Assistant',
  subtitle: 'Healthcare information & hospital navigation',
  statusReady: 'Ready to help',
  statusListening: 'Listening…',
  statusThinking: 'Thinking…',
  statusSpeaking: 'Speaking…',
  statusConnecting: 'Connecting…',
  mic: 'Microphone',
  keyboard: 'Keyboard',
  speaker: 'Speaker',
  end: 'End conversation',
  mute: 'Mute microphone',
  close: 'Close assistant',
  send: 'Send',
  placeholder: 'Ask about hospitals, travel time, or a health question…',
  chipFind: 'Find nearby hospitals',
  chipCompare: 'Compare hospitals',
  chipTravel: 'Check travel time',
  chipHealth: 'Ask a health question',
  disclaimer:
    'General information only — not a diagnosis or a prescription. For emergencies call 112 immediately.',
  voiceUnsupported: 'Voice input is not supported in this browser. You can type instead.',
  transcript: 'Transcript',
  poweredBy: 'Powered by Google Gemini',
  newChat: 'New conversation',
  emergencyBanner: 'Not medical advice · Emergency? Call 112',
};

const ASSISTANT_HI: AssistantStrings = {
  title: 'JeevanSetu AI सहायक',
  subtitle: 'स्वास्थ्य जानकारी और अस्पताल मार्गदर्शन',
  statusReady: 'मदद के लिए तैयार',
  statusListening: 'सुन रहा हूं…',
  statusThinking: 'सोच रहा हूं…',
  statusSpeaking: 'बोल रहा हूं…',
  statusConnecting: 'कनेक्ट हो रहा है…',
  mic: 'माइक्रोफ़ोन',
  keyboard: 'कीबोर्ड',
  speaker: 'स्पीकर',
  end: 'बातचीत समाप्त करें',
  mute: 'माइक्रोफ़ोन म्यूट करें',
  close: 'सहायक बंद करें',
  send: 'भेजें',
  placeholder: 'अस्पताल, यात्रा समय या स्वास्थ्य से जुड़ा सवाल पूछें…',
  chipFind: 'पास के अस्पताल खोजें',
  chipCompare: 'अस्पतालों की तुलना करें',
  chipTravel: 'यात्रा समय देखें',
  chipHealth: 'स्वास्थ्य संबंधी सवाल पूछें',
  disclaimer: 'केवल सामान्य जानकारी — कोई निदान या पर्चा नहीं। आपात स्थिति में तुरंत 112 पर कॉल करें।',
  voiceUnsupported: 'इस ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। आप टाइप कर सकते हैं।',
  transcript: 'ट्रांसक्रिप्ट',
  poweredBy: 'Google Gemini द्वारा संचालित',
  newChat: 'नई बातचीत',
  emergencyBanner: 'चिकित्सा सलाह नहीं · आपात स्थिति? 112 पर कॉल करें',
};

/**
 * Partial overrides for the remaining nine languages. Anything omitted falls
 * back to English rather than showing a broken or machine-mangled medical text.
 */
type PartialOverrides<T> = { [K in keyof T]?: string };

const DISTANCE_OVERRIDES: Record<Exclude<Lang, 'en' | 'hi'>, PartialOverrides<DistanceStrings>> = {
  bn: {
    drivingDistance: 'সড়ক দূরত্ব',
    straightLine: 'আনুমানিক সরলরেখার দূরত্ব',
    distanceUnavailable: 'সড়ক দূরত্ব পাওয়া যায়নি',
    eta: 'আনুমানিক পৌঁছানোর সময়',
    trafficImpact: 'ট্রাফিক প্রভাব',
    navigateGmaps: 'Google Maps দিয়ে নেভিগেট করুন',
    lastUpdated: 'সর্বশেষ আপডেট',
    alternatives: 'বিকল্প পথ',
  },
  te: {
    drivingDistance: 'రోడ్డు దూరం',
    straightLine: 'సుమారు సరళ రేఖ దూరం',
    distanceUnavailable: 'రోడ్డు దూరం అందుబాటులో లేదు',
    eta: 'అంచనా చేరుకునే సమయం',
    trafficImpact: 'ట్రాఫిక్ ప్రభావం',
    navigateGmaps: 'Google Maps తో నావిగేట్ చేయండి',
    lastUpdated: 'చివరిగా నవీకరించబడింది',
    alternatives: 'ప్రత్యామ్నాయ మార్గాలు',
  },
  mr: {
    drivingDistance: 'रस्त्याचे अंतर',
    straightLine: 'अंदाजे सरळ रेषेतील अंतर',
    distanceUnavailable: 'रस्त्याचे अंतर उपलब्ध नाही',
    eta: 'अंदाजे पोहोचण्याची वेळ',
    trafficImpact: 'वाहतूक परिणाम',
    navigateGmaps: 'Google Maps ने नेव्हिगेट करा',
    lastUpdated: 'शेवटचे अपडेट',
    alternatives: 'पर्यायी मार्ग',
  },
  ta: {
    drivingDistance: 'சாலை தூரம்',
    straightLine: 'தோராயமான நேர்கோட்டு தூரம்',
    distanceUnavailable: 'சாலை தூரம் கிடைக்கவில்லை',
    eta: 'மதிப்பிடப்பட்ட சேரும நேரம்',
    trafficImpact: 'போக்குவரத்து தாக்கம்',
    navigateGmaps: 'Google Maps மூலம் வழிகாட்டு',
    lastUpdated: 'கடைசியாக புதுப்பிக்கப்பட்டது',
    alternatives: 'மாற்று வழிகள்',
  },
  gu: {
    drivingDistance: 'રસ્તાનું અંતર',
    straightLine: 'અંદાજિત સીધું અંતર',
    distanceUnavailable: 'રસ્તાનું અંતર ઉપલબ્ધ નથી',
    eta: 'અંદાજિત પહોંચવાનો સમય',
    trafficImpact: 'ટ્રાફિક અસર',
    navigateGmaps: 'Google Maps સાથે નેવિગેટ કરો',
    lastUpdated: 'છેલ્લે અપડેટ થયું',
    alternatives: 'વૈકલ્પિક માર્ગો',
  },
  ur: {
    drivingDistance: 'سڑک کا فاصلہ',
    straightLine: 'تخمینی سیدھا فاصلہ',
    distanceUnavailable: 'سڑک کا فاصلہ دستیاب نہیں',
    eta: 'متوقع پہنچنے کا وقت',
    trafficImpact: 'ٹریفک کا اثر',
    navigateGmaps: 'Google Maps کے ساتھ نیویگیٹ کریں',
    lastUpdated: 'آخری اپ ڈیٹ',
    alternatives: 'متبادل راستے',
  },
  kn: {
    drivingDistance: 'ರಸ್ತೆ ದೂರ',
    straightLine: 'ಅಂದಾಜು ನೇರ ರೇಖೆಯ ದೂರ',
    distanceUnavailable: 'ರಸ್ತೆ ದೂರ ಲಭ್ಯವಿಲ್ಲ',
    eta: 'ಅಂದಾಜು ತಲುಪುವ ಸಮಯ',
    trafficImpact: 'ಸಂಚಾರ ಪರಿಣಾಮ',
    navigateGmaps: 'Google Maps ನೊಂದಿಗೆ ನ್ಯಾವಿಗೇಟ್ ಮಾಡಿ',
    lastUpdated: 'ಕೊನೆಯ ನವೀಕರಣ',
    alternatives: 'ಪರ್ಯಾಯ ಮಾರ್ಗಗಳು',
  },
  or: {
    drivingDistance: 'ରାସ୍ତା ଦୂରତା',
    straightLine: 'ଆନୁମାନିକ ସିଧା ଦୂରତା',
    distanceUnavailable: 'ରାସ୍ତା ଦୂରତା ଉପଲବ୍ଧ ନାହିଁ',
    eta: 'ଆନୁମାନିକ ପହଞ୍ଚିବା ସମୟ',
    trafficImpact: 'ଟ୍ରାଫିକ ପ୍ରଭାବ',
    navigateGmaps: 'Google Maps ସହ ନାଭିଗେଟ କରନ୍ତୁ',
    lastUpdated: 'ଶେଷ ଅପଡେଟ',
    alternatives: 'ବିକଳ୍ପ ପଥ',
  },
  ml: {
    drivingDistance: 'റോഡ് ദൂരം',
    straightLine: 'ഏകദേശ നേർരേഖ ദൂരം',
    distanceUnavailable: 'റോഡ് ദൂരം ലഭ്യമല്ല',
    eta: 'ഏകദേശ എത്തിച്ചേരൽ സമയം',
    trafficImpact: 'ട്രാഫിക് സ്വാധീനം',
    navigateGmaps: 'Google Maps ഉപയോഗിച്ച് നാവിഗേറ്റ് ചെയ്യുക',
    lastUpdated: 'അവസാനം അപ്ഡേറ്റ് ചെയ്തത്',
    alternatives: 'ബദൽ വഴികൾ',
  },
};

const LOCATION_OVERRIDES: Record<Exclude<Lang, 'en' | 'hi'>, PartialOverrides<LocationStrings>> = {
  bn: {
    usePrecise: 'আমার সঠিক অবস্থান ব্যবহার করুন',
    retry: 'অবস্থান আবার নিন',
    change: 'অবস্থান পরিবর্তন করুন',
    selectOnMap: 'ম্যাপে অবস্থান নির্বাচন করুন',
    searchAddress: 'ঠিকানা দিয়ে খুঁজুন',
    searchPincode: 'পিন কোড দিয়ে খুঁজুন',
    notSet: 'অবস্থান নির্ধারিত নয়',
    orPickCity: 'অথবা শহর বেছে নিন',
  },
  te: {
    usePrecise: 'నా ఖచ్చితమైన స్థానాన్ని ఉపయోగించండి',
    retry: 'స్థానాన్ని మళ్లీ పొందండి',
    change: 'స్థానాన్ని మార్చండి',
    selectOnMap: 'మ్యాప్‌లో స్థానాన్ని ఎంచుకోండి',
    searchAddress: 'చిరునామా ద్వారా వెతకండి',
    searchPincode: 'పిన్ కోడ్ ద్వారా వెతకండి',
    notSet: 'స్థానం సెట్ చేయలేదు',
    orPickCity: 'లేదా నగరాన్ని ఎంచుకోండి',
  },
  mr: {
    usePrecise: 'माझे अचूक स्थान वापरा',
    retry: 'स्थान पुन्हा घ्या',
    change: 'स्थान बदला',
    selectOnMap: 'नकाशावर स्थान निवडा',
    searchAddress: 'पत्त्याने शोधा',
    searchPincode: 'पिन कोडने शोधा',
    notSet: 'स्थान सेट केलेले नाही',
    orPickCity: 'किंवा शहर निवडा',
  },
  ta: {
    usePrecise: 'எனது துல்லியமான இருப்பிடத்தைப் பயன்படுத்து',
    retry: 'இருப்பிடத்தை மீண்டும் பெறு',
    change: 'இருப்பிடத்தை மாற்று',
    selectOnMap: 'வரைபடத்தில் இருப்பிடத்தைத் தேர்ந்தெடு',
    searchAddress: 'முகவரி மூலம் தேடு',
    searchPincode: 'பின் கோட் மூலம் தேடு',
    notSet: 'இருப்பிடம் அமைக்கப்படவில்லை',
    orPickCity: 'அல்லது நகரத்தைத் தேர்ந்தெடு',
  },
  gu: {
    usePrecise: 'મારું સચોટ સ્થાન વાપરો',
    retry: 'સ્થાન ફરી મેળવો',
    change: 'સ્થાન બદલો',
    selectOnMap: 'નકશા પર સ્થાન પસંદ કરો',
    searchAddress: 'સરનામાથી શોધો',
    searchPincode: 'પિન કોડથી શોધો',
    notSet: 'સ્થાન સેટ નથી',
    orPickCity: 'અથવા શહેર પસંદ કરો',
  },
  ur: {
    usePrecise: 'میرا درست مقام استعمال کریں',
    retry: 'مقام دوبارہ حاصل کریں',
    change: 'مقام تبدیل کریں',
    selectOnMap: 'نقشے پر مقام منتخب کریں',
    searchAddress: 'پتے سے تلاش کریں',
    searchPincode: 'پن کوڈ سے تلاش کریں',
    notSet: 'مقام مقرر نہیں',
    orPickCity: 'یا شہر منتخب کریں',
  },
  kn: {
    usePrecise: 'ನನ್ನ ನಿಖರ ಸ್ಥಳ ಬಳಸಿ',
    retry: 'ಸ್ಥಳವನ್ನು ಮತ್ತೆ ಪಡೆಯಿರಿ',
    change: 'ಸ್ಥಳ ಬದಲಿಸಿ',
    selectOnMap: 'ನಕ್ಷೆಯಲ್ಲಿ ಸ್ಥಳ ಆಯ್ಕೆಮಾಡಿ',
    searchAddress: 'ವಿಳಾಸದಿಂದ ಹುಡುಕಿ',
    searchPincode: 'ಪಿನ್ ಕೋಡ್‌ನಿಂದ ಹುಡುಕಿ',
    notSet: 'ಸ್ಥಳ ನಿಗದಿಯಾಗಿಲ್ಲ',
    orPickCity: 'ಅಥವಾ ನಗರ ಆಯ್ಕೆಮಾಡಿ',
  },
  or: {
    usePrecise: 'ମୋର ସଠିକ ସ୍ଥାନ ବ୍ୟବହାର କରନ୍ତୁ',
    retry: 'ସ୍ଥାନ ପୁନଃ ନିଅନ୍ତୁ',
    change: 'ସ୍ଥାନ ବଦଳାନ୍ତୁ',
    selectOnMap: 'ମ୍ୟାପରେ ସ୍ଥାନ ଚୟନ କରନ୍ତୁ',
    searchAddress: 'ଠିକଣାରୁ ଖୋଜନ୍ତୁ',
    searchPincode: 'ପିନ କୋଡରୁ ଖୋଜନ୍ତୁ',
    notSet: 'ସ୍ଥାନ ସେଟ ହୋଇନାହିଁ',
    orPickCity: 'କିମ୍ବା ସହର ଚୟନ କରନ୍ତୁ',
  },
  ml: {
    usePrecise: 'എന്റെ കൃത്യമായ സ്ഥാനം ഉപയോഗിക്കുക',
    retry: 'സ്ഥാനം വീണ്ടും എടുക്കുക',
    change: 'സ്ഥാനം മാറ്റുക',
    selectOnMap: 'മാപ്പിൽ സ്ഥാനം തിരഞ്ഞെടുക്കുക',
    searchAddress: 'വിലാസം വഴി തിരയുക',
    searchPincode: 'പിൻ കോഡ് വഴി തിരയുക',
    notSet: 'സ്ഥാനം സെറ്റ് ചെയ്തിട്ടില്ല',
    orPickCity: 'അല്ലെങ്കിൽ നഗരം തിരഞ്ഞെടുക്കുക',
  },
};

const ASSISTANT_OVERRIDES: Record<Exclude<Lang, 'en' | 'hi'>, PartialOverrides<AssistantStrings>> = {
  bn: {
    title: 'JeevanSetu AI সহায়ক',
    subtitle: 'স্বাস্থ্য তথ্য ও হাসপাতাল পথনির্দেশ',
    statusReady: 'সাহায্যের জন্য প্রস্তুত',
    statusListening: 'শুনছি…',
    statusThinking: 'ভাবছি…',
    statusSpeaking: 'বলছি…',
    statusConnecting: 'সংযুক্ত হচ্ছে…',
    mic: 'মাইক্রোফোন',
    keyboard: 'কীবোর্ড',
    speaker: 'স্পিকার',
    end: 'কথোপকথন শেষ করুন',
    mute: 'মাইক্রোফোন মিউট করুন',
    close: 'সহায়ক বন্ধ করুন',
    send: 'পাঠান',
    placeholder: 'হাসপাতাল, যাতায়াতের সময় বা স্বাস্থ্য নিয়ে প্রশ্ন করুন…',
    chipFind: 'কাছাকাছি হাসপাতাল খুঁজুন',
    chipCompare: 'হাসপাতাল তুলনা করুন',
    chipTravel: 'যাতায়াতের সময় দেখুন',
    chipHealth: 'স্বাস্থ্য প্রশ্ন করুন',
  },
  te: {
    title: 'JeevanSetu AI సహాయకుడు',
    subtitle: 'ఆరోగ్య సమాచారం & ఆసుపత్రి మార్గదర్శనం',
    statusReady: 'సహాయానికి సిద్ధం',
    statusListening: 'వినిపిస్తోంది…',
    statusThinking: 'ఆలోచిస్తోంది…',
    statusSpeaking: 'మాట్లాడుతోంది…',
    statusConnecting: 'కనెక్ట్ అవుతోంది…',
    mic: 'మైక్రోఫోన్',
    keyboard: 'కీబోర్డ్',
    speaker: 'స్పీకర్',
    end: 'సంభాషణ ముగించండి',
    mute: 'మైక్రోఫోన్ మ్యూట్ చేయండి',
    close: 'సహాయకుడిని మూసివేయండి',
    send: 'పంపండి',
    placeholder: 'ఆసుపత్రులు, ప్రయాణ సమయం లేదా ఆరోగ్య ప్రశ్న అడగండి…',
    chipFind: 'సమీప ఆసుపత్రులు వెతకండి',
    chipCompare: 'ఆసుపత్రులను పోల్చండి',
    chipTravel: 'ప్రయాణ సమయం చూడండి',
    chipHealth: 'ఆరోగ్య ప్రశ్న అడగండి',
  },
  mr: {
    title: 'JeevanSetu AI सहाय्यक',
    subtitle: 'आरोग्य माहिती आणि रुग्णालय मार्गदर्शन',
    statusReady: 'मदतीसाठी तयार',
    statusListening: 'ऐकत आहे…',
    statusThinking: 'विचार करत आहे…',
    statusSpeaking: 'बोलत आहे…',
    statusConnecting: 'जोडत आहे…',
    mic: 'मायक्रोफोन',
    keyboard: 'कीबोर्ड',
    speaker: 'स्पीकर',
    end: 'संभाषण संपवा',
    mute: 'मायक्रोफोन म्यूट करा',
    close: 'सहाय्यक बंद करा',
    send: 'पाठवा',
    placeholder: 'रुग्णालये, प्रवासाचा वेळ किंवा आरोग्य प्रश्न विचारा…',
    chipFind: 'जवळची रुग्णालये शोधा',
    chipCompare: 'रुग्णालयांची तुलना करा',
    chipTravel: 'प्रवासाचा वेळ पहा',
    chipHealth: 'आरोग्य प्रश्न विचारा',
  },
  ta: {
    title: 'JeevanSetu AI உதவியாளர்',
    subtitle: 'சுகாதார தகவல் & மருத்துவமனை வழிகாட்டல்',
    statusReady: 'உதவ தயார்',
    statusListening: 'கேட்கிறது…',
    statusThinking: 'யோசிக்கிறது…',
    statusSpeaking: 'பேசுகிறது…',
    statusConnecting: 'இணைக்கிறது…',
    mic: 'ஒலிவாங்கி',
    keyboard: 'விசைப்பலகை',
    speaker: 'ஒலிபெருக்கி',
    end: 'உரையாடலை முடி',
    mute: 'ஒலிவாங்கியை முடக்கு',
    close: 'உதவியாளரை மூடு',
    send: 'அனுப்பு',
    placeholder: 'மருத்துவமனைகள், பயண நேரம் அல்லது சுகாதாரக் கேள்வி கேளுங்கள்…',
    chipFind: 'அருகிலுள்ள மருத்துவமனைகளைத் தேடு',
    chipCompare: 'மருத்துவமனைகளை ஒப்பிடு',
    chipTravel: 'பயண நேரத்தைப் பார்',
    chipHealth: 'சுகாதாரக் கேள்வி கேள்',
  },
  gu: {
    title: 'JeevanSetu AI સહાયક',
    subtitle: 'આરોગ્ય માહિતી અને હોસ્પિટલ માર્ગદર્શન',
    statusReady: 'મદદ માટે તૈયાર',
    statusListening: 'સાંભળી રહ્યું છે…',
    statusThinking: 'વિચારી રહ્યું છે…',
    statusSpeaking: 'બોલી રહ્યું છે…',
    statusConnecting: 'કનેક્ટ થઈ રહ્યું છે…',
    mic: 'માઇક્રોફોન',
    keyboard: 'કીબોર્ડ',
    speaker: 'સ્પીકર',
    end: 'વાતચીત સમાપ્ત કરો',
    mute: 'માઇક્રોફોન મ્યૂટ કરો',
    close: 'સહાયક બંધ કરો',
    send: 'મોકલો',
    placeholder: 'હોસ્પિટલ, મુસાફરીનો સમય કે આરોગ્ય પ્રશ્ન પૂછો…',
    chipFind: 'નજીકની હોસ્પિટલ શોધો',
    chipCompare: 'હોસ્પિટલની તુલના કરો',
    chipTravel: 'મુસાફરીનો સમય જુઓ',
    chipHealth: 'આરોગ્ય પ્રશ્ન પૂછો',
  },
  ur: {
    title: 'JeevanSetu AI معاون',
    subtitle: 'صحت کی معلومات اور اسپتال کی رہنمائی',
    statusReady: 'مدد کے لیے تیار',
    statusListening: 'سن رہا ہوں…',
    statusThinking: 'سوچ رہا ہوں…',
    statusSpeaking: 'بول رہا ہوں…',
    statusConnecting: 'منسلک ہو رہا ہے…',
    mic: 'مائیکروفون',
    keyboard: 'کی بورڈ',
    speaker: 'اسپیکر',
    end: 'گفتگو ختم کریں',
    mute: 'مائیکروفون خاموش کریں',
    close: 'معاون بند کریں',
    send: 'بھیجیں',
    placeholder: 'اسپتال، سفر کا وقت یا صحت سے متعلق سوال پوچھیں…',
    chipFind: 'قریبی اسپتال تلاش کریں',
    chipCompare: 'اسپتالوں کا موازنہ کریں',
    chipTravel: 'سفر کا وقت دیکھیں',
    chipHealth: 'صحت کا سوال پوچھیں',
  },
  kn: {
    title: 'JeevanSetu AI ಸಹಾಯಕ',
    subtitle: 'ಆರೋಗ್ಯ ಮಾಹಿತಿ ಮತ್ತು ಆಸ್ಪತ್ರೆ ಮಾರ್ಗದರ್ಶನ',
    statusReady: 'ಸಹಾಯಕ್ಕೆ ಸಿದ್ಧ',
    statusListening: 'ಕೇಳುತ್ತಿದೆ…',
    statusThinking: 'ಯೋಚಿಸುತ್ತಿದೆ…',
    statusSpeaking: 'ಮಾತನಾಡುತ್ತಿದೆ…',
    statusConnecting: 'ಸಂಪರ್ಕಿಸುತ್ತಿದೆ…',
    mic: 'ಮೈಕ್ರೊಫೋನ್',
    keyboard: 'ಕೀಬೋರ್ಡ್',
    speaker: 'ಸ್ಪೀಕರ್',
    end: 'ಸಂಭಾಷಣೆ ಮುಗಿಸಿ',
    mute: 'ಮೈಕ್ರೊಫೋನ್ ಮ್ಯೂಟ್ ಮಾಡಿ',
    close: 'ಸಹಾಯಕ ಮುಚ್ಚಿ',
    send: 'ಕಳುಹಿಸಿ',
    placeholder: 'ಆಸ್ಪತ್ರೆ, ಪ್ರಯಾಣದ ಸಮಯ ಅಥವಾ ಆರೋಗ್ಯ ಪ್ರಶ್ನೆ ಕೇಳಿ…',
    chipFind: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗಳನ್ನು ಹುಡುಕಿ',
    chipCompare: 'ಆಸ್ಪತ್ರೆಗಳನ್ನು ಹೋಲಿಸಿ',
    chipTravel: 'ಪ್ರಯಾಣದ ಸಮಯ ನೋಡಿ',
    chipHealth: 'ಆರೋಗ್ಯ ಪ್ರಶ್ನೆ ಕೇಳಿ',
  },
  or: {
    title: 'JeevanSetu AI ସହାୟକ',
    subtitle: 'ସ୍ୱାସ୍ଥ୍ୟ ସୂଚନା ଓ ଡାକ୍ତରଖାନା ମାର୍ଗଦର୍ଶନ',
    statusReady: 'ସହାୟତା ପାଇଁ ପ୍ରସ୍ତୁତ',
    statusListening: 'ଶୁଣୁଛି…',
    statusThinking: 'ଭାବୁଛି…',
    statusSpeaking: 'କହୁଛି…',
    statusConnecting: 'ସଂଯୋଗ ହେଉଛି…',
    mic: 'ମାଇକ୍ରୋଫୋନ',
    keyboard: 'କୀବୋର୍ଡ',
    speaker: 'ସ୍ପିକର',
    end: 'କଥାବାର୍ତ୍ତା ଶେଷ କରନ୍ତୁ',
    mute: 'ମାଇକ୍ରୋଫୋନ ମ୍ୟୁଟ କରନ୍ତୁ',
    close: 'ସହାୟକ ବନ୍ଦ କରନ୍ତୁ',
    send: 'ପଠାନ୍ତୁ',
    placeholder: 'ଡାକ୍ତରଖାନା, ଯାତ୍ରା ସମୟ କିମ୍ବା ସ୍ୱାସ୍ଥ୍ୟ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ…',
    chipFind: 'ନିକଟସ୍ଥ ଡାକ୍ତରଖାନା ଖୋଜନ୍ତୁ',
    chipCompare: 'ଡାକ୍ତରଖାନା ତୁଳନା କରନ୍ତୁ',
    chipTravel: 'ଯାତ୍ରା ସମୟ ଦେଖନ୍ତୁ',
    chipHealth: 'ସ୍ୱାସ୍ଥ୍ୟ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ',
  },
  ml: {
    title: 'JeevanSetu AI അസിസ്റ്റന്റ്',
    subtitle: 'ആരോഗ്യ വിവരങ്ങളും ആശുപത്രി വഴികാട്ടലും',
    statusReady: 'സഹായത്തിന് തയ്യാർ',
    statusListening: 'കേൾക്കുന്നു…',
    statusThinking: 'ചിന്തിക്കുന്നു…',
    statusSpeaking: 'സംസാരിക്കുന്നു…',
    statusConnecting: 'ബന്ധിപ്പിക്കുന്നു…',
    mic: 'മൈക്രോഫോൺ',
    keyboard: 'കീബോർഡ്',
    speaker: 'സ്പീക്കർ',
    end: 'സംഭാഷണം അവസാനിപ്പിക്കുക',
    mute: 'മൈക്രോഫോൺ മ്യൂട്ട് ചെയ്യുക',
    close: 'അസിസ്റ്റന്റ് അടയ്ക്കുക',
    send: 'അയയ്ക്കുക',
    placeholder: 'ആശുപത്രികൾ, യാത്രാ സമയം അല്ലെങ്കിൽ ആരോഗ്യ ചോദ്യം ചോദിക്കുക…',
    chipFind: 'അടുത്തുള്ള ആശുപത്രികൾ കണ്ടെത്തുക',
    chipCompare: 'ആശുപത്രികൾ താരതമ്യം ചെയ്യുക',
    chipTravel: 'യാത്രാ സമയം നോക്കുക',
    chipHealth: 'ആരോഗ്യ ചോദ്യം ചോദിക്കുക',
  },
};

export const DISTANCE_STRINGS: Record<Lang, DistanceStrings> = {
  en: DISTANCE_EN,
  hi: DISTANCE_HI,
  ...(Object.fromEntries(
    Object.entries(DISTANCE_OVERRIDES).map(([k, v]) => [k, { ...DISTANCE_EN, ...v }]),
  ) as Record<Exclude<Lang, 'en' | 'hi'>, DistanceStrings>),
};

export const LOCATION_STRINGS: Record<Lang, LocationStrings> = {
  en: LOCATION_EN,
  hi: LOCATION_HI,
  ...(Object.fromEntries(
    Object.entries(LOCATION_OVERRIDES).map(([k, v]) => [k, { ...LOCATION_EN, ...v }]),
  ) as Record<Exclude<Lang, 'en' | 'hi'>, LocationStrings>),
};

export const ASSISTANT_STRINGS: Record<Lang, AssistantStrings> = {
  en: ASSISTANT_EN,
  hi: ASSISTANT_HI,
  ...(Object.fromEntries(
    Object.entries(ASSISTANT_OVERRIDES).map(([k, v]) => [k, { ...ASSISTANT_EN, ...v }]),
  ) as Record<Exclude<Lang, 'en' | 'hi'>, AssistantStrings>),
};

export function distanceStrings(lang: Lang): DistanceStrings {
  return DISTANCE_STRINGS[lang] ?? DISTANCE_EN;
}
export function locationStrings(lang: Lang): LocationStrings {
  return LOCATION_STRINGS[lang] ?? LOCATION_EN;
}
export function assistantStrings(lang: Lang): AssistantStrings {
  return ASSISTANT_STRINGS[lang] ?? ASSISTANT_EN;
}

/**
 * Languages where we have verified that browser SpeechRecognition + Gemini
 * transcription behave correctly. We never advertise voice for a language that
 * is not on this list — text fallback is offered instead.
 */
export const VOICE_VERIFIED_LANGS: Lang[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'ur', 'or'];
