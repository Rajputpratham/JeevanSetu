/**
 * JeevanSetu AI Assistant — intent recognition.
 *
 * Requirement 5 & 7: the assistant must recognise what the user actually wants
 * before touching any tool. Greetings must never trigger a hospital search.
 *
 * This is a deterministic, explainable classifier (keyword + pattern + light
 * conversation-history context) rather than a black box, because:
 *   • it must work even when Gemini is unavailable (API-failure fallback), and
 *   • intent gating is a SAFETY boundary — a hospital search must not fire
 *     because a model hallucinated one.
 *
 * Gemini still handles the natural language *wording* and handles anything the
 * rules cannot place confidently (`unknown`), which is then answered
 * conversationally rather than by dumping hospital cards.
 */

export type Intent =
  | 'greeting'
  | 'casual'
  | 'identity'
  | 'thanks'
  | 'closing'
  | 'health_info'
  | 'hospital_search'
  | 'hospital_compare'
  | 'location_travel'
  | 'emergency'
  | 'website_help'
  | 'followup'
  | 'unsupported'
  | 'unknown';

export interface IntentResult {
  intent: Intent;
  /** 0–1. Values below the confidence gate are treated as `unknown`. */
  confidence: number;
  /** Whether a hospital-search tool may run for this message. */
  allowHospitalTools: boolean;
  /** Whether any location/permission prompt may run for this message. */
  allowLocationPrompt: boolean;
  /** True when the user is in immediate danger and advice must not be delayed. */
  emergency: boolean;
  /** Speciality guess for health questions (never a diagnosis). */
  suggestedSpeciality: string | null;
  /** Hospital names explicitly mentioned, in order of appearance. */
  mentionedHospitalTerms: string[];
  /** Conversation-language request inside the message, if any. */
  requestedLanguage: string | null;
  /** Signals used, for the transparency panel / tests. */
  signals: string[];
}

/** Red-flag symptoms that must short-circuit every other reply. */
const EMERGENCY_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(severe|crushing|heavy)\s+(chest|chest pain)|\bchest pain\b.*\b(breath|sweat|arm)\b/i, label: 'chest-pain' },
  { re: /\b(heart attack|cardiac arrest|stroke|paralysis|unconscious|not breathing|no pulse)\b/i, label: 'cardiac' },
  { re: /\b(can'?t breathe|cannot breathe|difficulty breathing|shortness of breath|gasping)\b/i, label: 'breathing' },
  { re: /\b(heavy bleeding|bleeding heavily|blood loss|severe bleeding)\b/i, label: 'bleeding' },
  { re: /\b(overdose|poison|poisoning|snake bite|drowning|electrocution)\b/i, label: 'poison' },
  { re: /\b(seizure|fits|convulsion)\b/i, label: 'seizure' },
  { re: /\b(burn|burns)\b.*\b(severe|face|large|third degree)\b/i, label: 'burns' },
  { re: /\b(emergency|ambulance)\b/i, label: 'emergency-word' },
  {
    re: /सीने में (तेज़|तेज|भारी) दर्द|सांस नहीं आ रही|सांस लेने में कठिनाई|दिल का दौरा|लकवा|बेहोश|अत्यधिक खून|ज़हर|जहर/i,
    label: 'hi-emergency',
  },
  {
    re: /বুকে তীব্র ব্যথা|শ্বাস নিতে কষ্ট|হার্ট অ্যাটাক|অচেতন|প্রচুর রক্ত/i,
    label: 'bn-emergency',
  },
  { re: /తీవ్రమైన ఛాతీ నొప్పి|శ్వాస ఇబ్బంది|గుండెపోటు|స్పృహ తప్పడం/i, label: 'te-emergency' },
  { re: /तीव्र छातीत दुखणे|श्वास घेण्यास त्रास|हृदयविकाराचा झटका|बेशुद्ध/i, label: 'mr-emergency' },
  { re: /கடுமையான நெஞ்சு வலி|மூச்சுத்திணறல்|மாரடைப்பு|சுயநினைவு இழப்பு/i, label: 'ta-emergency' },
  { re: /તીવ્ર છાતીમાં દુખાવો|શ્વાસ લેવામાં તકલીફ|હાર્ટ એટેક|બેહોશ/i, label: 'gu-emergency' },
  { re: /شدید سینے میں درد|سانس لینے میں دشواری|ہارٹ اٹیک|بے ہوش/i, label: 'ur-emergency' },
  { re: /ತೀವ್ರ ಎದೆ ನೋವು|ಉಸಿರಾಟದ ತೊಂದರೆ|ಹೃದಯಾಘಾತ|ಪ್ರಜ್ಞೆ ತಪ್ಪುವುದು/i, label: 'kn-emergency' },
  { re: /ତୀବ୍ର ଛାତି ଯନ୍ତ୍ରଣା|ନିଶ୍ୱାସ ନେବାରେ ଅସୁବିଧା|ହୃଦଘାତ|ଅଚେତ/i, label: 'or-emergency' },
  { re: /തീവ്രമായ നെഞ്ചുവേദന|ശ്വാസതടസ്സം|ഹൃദയാഘാതം|ബോധക്ഷയം/i, label: 'ml-emergency' },
];

const GREETING_RE =
  /^(h+i+|hey+|hello+|hlo+|yo|namaste|namaskar|salaam|salam|sat ?sri ?akal|good (morning|afternoon|evening|day)|gm|morning|evening|नमस्ते|नमस्कार|हाय|हेलो|सुप्रभात|शुभ संध्या|নমস্কার|হ্যালো|నమస్కారం|నమస్తే|नमस्कार|வணக்கம்|નમસ્તે|السلام علیکم|سلام|ನಮಸ್ಕಾರ|ନମସ୍କାର|നമസ്കാരം)[\s!.,]*$/i;

const CASUAL_PATTERNS: RegExp[] = [
  /\bhow are you\b|\bhow do you do\b|\bhow'?s it going\b|\bwhat'?s up\b/i,
  /आप कैसे (हैं|हो)|कैसे हो|क्या हाल/i,
  /\bhow is your day\b|\bare you (ok|okay|fine|there)\b/i,
  /\bwhat can you do\b|\bwhat do you do\b|\bwho are you\b|\bwhat are you\b/i,
  /\byour name\b|\bapna naam\b|\btumhara naam\b|\baapka naam\b|आपका नाम|तुम्हारा नाम/i,
  /\bgood (job|work)\b|\bnice\b|\bcool\b|\bok(ay)?\b|\bhmm+\b/i,
];

const THANKS_RE =
  /^(thanks?|thank you|thankyou|thx|ty|dhanyavad|dhanyawad|shukriya|धन्यवाद|शुक्रिया|ধন্যবাদ|ధన్యవాదాలు|आभारी|நன்றி|આભાર|شکریہ|ಧನ್ಯವಾದ|ଧନ୍ୟବାଦ|നന്ദി)[\s!.]*$/i;

const CLOSING_RE =
  /\b(bye|goodbye|good night|goodnight|see you|that'?s all|nothing else|no thanks|exit|quit)\b|अलविदा|शुभ रात्रि|बाय|বিদায়|వీడ్కోలు|நன்றி வணக்கம்|આવજો|خدا حافظ|ವಿದಾಯ/i;

const COMPARE_RE =
  /\b(compare|comparison|better|vs\.?|versus|which (one )?is (better|good)|difference between)\b|तुलना|बेहतर|अच्छा कौन|তুলনা|పోల్చు|तुलना करा|ஒப்பிடு|તુલના|موازنہ|ಹೋಲಿಸಿ|ତୁଳନା|താരതമ്യം/i;

const SEARCH_RE =
  /\b(find|search|show|list|need|looking for|suggest|recommend|nearby|near me|near by|nearest|hospitals?|clinics?|nursing home|icu|emergency room|admit|admission|in\s+(delhi|mumbai|kolkata|chennai|bengaluru|bangalore|hyderabad|pune|jaipur|lucknow|noida|gurugram|gurgaon|ghaziabad|ahmedabad|bhubaneswar|kochi))\b|अस्पताल|नज़दीक|पास के|खोज|দেখান|খুঁজুন|হাসপাতাল|ఆసుపత్రి|వెతకండి|रुग्णालय|शोधा|மருத்துவமனை|தேடு|હોસ્પિટલ|શોધો|اسپتال|ತಲುಪು|ಆಸ್ಪತ್ರೆ|ଡାକ୍ତରଖାନା|ആശുപത്രി/i;

const TRAVEL_RE =
  /\b(how far|distance|driving|drive|travel time|time to reach|eta|reach|commute|traffic|km|kilometre|kilometer|minutes away|hours away|navigate|directions|route)\b|कितनी दूर|दूरी|कितना समय|पहुंचने|ড্রাইভ|দূরত্ব|దూరం|दूर|அளவு|தூரம்|અંતર|فاصلہ|ದೂರ|ଦୂରତା|ദൂരം/i;

const HEALTH_RE =
  /\b(pain|ache|hurts?|headache|migraine|fever|vomit|vomiting|nausea|diarrh|loose motion|stomach|cough|cold|sore throat|rash|itch|swelling|sugar|diabetes|bp|blood pressure|breathless|anxiety|depression|period|pregnan|dizzy|weakness|infection|burn|injur|fracture|toothache|eye|ear|skin|allerg)\b|दर्द|बुखार|दस्त|उल्टी|खांसी|सर्दी|चक्कर|कमजोरी|জ্বর|ব্যথা|ज्वर|దగ్గు|ज्वर|காய்ச்சல்|તાવ|بخار|ಜ್ವರ|ଜ୍ୱର|പനി|ദണ്ണം/i;

const WEBSITE_HELP_RE =
  /\b(how do i use|where do i|website|cost estimator|cost estimate|treatment cost|price|estimate|ranking|rankings|rating|review|save|bookmark|languages?|language|change language|hindi|english|privacy|disclaimer|account|sign up|app)\b|वेबसाइट|खर्च|अनुमान|रैंकिंग|रेटिंग|भाषा|साइट/i;

const UNSUPPORTED_RE =
  /\b(prescribe|prescription|dosage|dose of|mg\b|which (tablet|medicine|drug)|medicine name|antibiotic|steroid|buy medicine|live bed|bed availability|icu bed (available|free)|ambulance (available|is coming)|is my (report|scan) normal|do i have (cancer|diabetes|tb)|guarantee|cure)\b|दवा|दवाई|गोली|कौन सी दवा|खाली बेड|बेड उपलब्ध/i;

const FOLLOWUP_RE =
  /^(and|also|then|what about|ok and|aur|और|तो|फिर)\b|^(it|this|that|they|he|she|its)\b|^(why|how come|really)\b/i;

const LANGUAGE_REQUESTS: { re: RegExp; lang: string }[] = [
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(hindi|हिंदी|हिन्दी)\b|^hindi\b/i, lang: 'hi' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(english)\b|^english\b/i, lang: 'en' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(bengali|বাংলা)\b/i, lang: 'bn' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(tamil|தமிழ்)\b/i, lang: 'ta' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(telugu|తెలుగు)\b/i, lang: 'te' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(marathi|मराठी)\b/i, lang: 'mr' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(gujarati|ગુજરાતી)\b/i, lang: 'gu' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(urdu|اردو)\b/i, lang: 'ur' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(kannada|ಕನ್ನಡ)\b/i, lang: 'kn' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(odia|oriya|ଓଡ଼ିଆ)\b/i, lang: 'or' },
  { re: /\b(in|speak|reply|answer|talk)\b.*\b(malayalam|മലയാളം)\b/i, lang: 'ml' },
];

/** Problem → speciality hints (informational routing only, never a diagnosis). */
const SPECIALITY_HINTS: { re: RegExp; speciality: string }[] = [
  { re: /\bchest pain|heart|cardiac|angina|palpitation|bp\b|blood pressure|cholest/i, speciality: 'Cardiology' },
  { re: /\bpregnan|delivery|maternity|gynae|gyne|period|menstrual/i, speciality: 'Gynaecology & Obstetrics' },
  { re: /\bchild|kid|baby|infant|paediatric|pediatric|vaccin/i, speciality: 'Paediatrics' },
  { re: /\beye|vision|cataract|retina|spectacle/i, speciality: 'Ophthalmology' },
  { re: /\bbone|fracture|joint|knee|hip|sprain|back pain|ortho/i, speciality: 'Orthopaedics' },
  { re: /\bcancer|tumour|tumor|oncolog|chemo/i, speciality: 'Oncology' },
  { re: /\bkidney|dialysis|renal|urine|prostate|stone/i, speciality: 'Urology' },
  { re: /\bstomach|digest|acidity|liver|gastro|appendix|vomit|nausea|loose motion|diarrh/i, speciality: 'Gastroenterology' },
  { re: /\bskin|rash|acne|allergy|itch|dermat/i, speciality: 'Dermatology' },
  { re: /\bmental|depress|anxiety|stress|sleep|psych/i, speciality: 'Psychiatry' },
  { re: /\bsugar|diabetes|thyroid|hormone|endocrin/i, speciality: 'Endocrinology' },
  { re: /\bear|nose|throat|sinus|tonsil|ent\b/i, speciality: 'ENT' },
  { re: /\bbreath|asthma|lung|cough|pneumonia|tb\b|pulmon/i, speciality: 'Pulmonology' },
  { re: /\bbrain|stroke|seizure|paralysis|neuro|migraine/i, speciality: 'Neurology' },
  { re: /\btooth|teeth|dental|dentist/i, speciality: 'Dental' },
  { re: /\bburn|scald/i, speciality: 'Burn & Plastic Surgery' },
  { re: /\bfever|infection|weakness|headache|checkup|check-up/i, speciality: 'General Medicine' },
  { re: /\bsurgery|operation|hernia/i, speciality: 'General Surgery' },
];

/** Well-known hospital shorthands used to resolve "how far is BSA Hospital?". */
export const HOSPITAL_ALIASES: { term: RegExp; id: string }[] = [
  { term: /\baiims\b(?!.*bhubaneswar)/i, id: 'aiims-new-delhi' },
  { term: /\baiims bhubaneswar\b/i, id: 'aiims-bhubaneswar' },
  { term: /\bsafdarjung\b/i, id: 'safdarjung-hospital' },
  { term: /\b(rml|ram manohar lohia)\b/i, id: 'rml-hospital' },
  { term: /\b(lok nayak|lnjp)\b/i, id: 'lok-nayak-hospital' },
  { term: /\b(gtb|guru ?teg ?bahadur)\b/i, id: 'gtb-hospital' },
  { term: /\b(ddu|deen dayal)\b/i, id: 'ddu-hospital' },
  { term: /\b(bsa|baba saheb ambedkar|ambedkar hospital)\b/i, id: 'bsa-hospital' },
  { term: /\b(bjrm|jagjivan ram)\b/i, id: 'bjrm-hospital' },
  { term: /\b(hindu rao)\b/i, id: 'barahindurao-hospital' },
  { term: /\b(lbs|khichripur)\b/i, id: 'lbs-khichripur' },
  { term: /\b(ganga ram)\b/i, id: 'sir-ganga-ram-hospital' },
  { term: /\bmax saket\b/i, id: 'max-saket' },
  { term: /\b(blk|pusa road hospital)\b/i, id: 'blk-max-pusa' },
  { term: /\b(apollo|indraprastha)\b/i, id: 'apollo-indraprastha' },
  { term: /\b(fortis escorts|escorts)\b/i, id: 'fortis-escorts-okhla' },
  { term: /\bfortis vasant kunj\b/i, id: 'fortis-vasant-kunj' },
  { term: /\bmedanta\b/i, id: 'medanta-medicity' },
  { term: /\b(fmri|fortis memorial)\b/i, id: 'fmri-gurugram' },
  { term: /\bkailash\b/i, id: 'kailash-noida' },
  { term: /\bsharda\b/i, id: 'sharda-greater-noida' },
  { term: /\byashoda\b/i, id: 'yashoda-ghaziabad' },
  { term: /\b(kem|paral)\b/i, id: 'kem-mumbai' },
  { term: /\btata memorial\b/i, id: 'tata-memorial-mumbai' },
  { term: /\bsassoon\b/i, id: 'sassoon-pune' },
  { term: /\b(sms|sawai man singh)\b/i, id: 'sms-jaipur' },
  { term: /\bkgmu\b/i, id: 'kgmu-lucknow' },
  { term: /\bsgpgi\b/i, id: 'sgpgi-lucknow' },
  { term: /\bsskm\b/i, id: 'sskm-kolkata' },
  { term: /\bvictoria\b/i, id: 'victoria-bengaluru' },
  { term: /\b(ggh|general hospital chennai)\b/i, id: 'ggh-chennai' },
  { term: /\bcivil hospital\b/i, id: 'civil-ahmedabad' },
  { term: /\bosmania\b/i, id: 'osmania-hyderabad' },
  { term: /\bernakulam general\b/i, id: 'ernakulam-general-kochi' },
];

export interface ClassifyOptions {
  /** Previous user/assistant turns, oldest first — used for follow-ups. */
  history?: { role: 'user' | 'assistant'; text: string }[];
  /** Local IST hour, for time-of-day greetings. */
  istHour?: number;
}

/**
 * Cities the dataset actually covers, with the names users type for them
 * (English + native script). Used to resolve "hospitals in Kolkata" even with a
 * GPS origin in Delhi — the user is asking about Kolkata, not about their couch.
 */
const CITY_ALIASES: { re: RegExp; city: string }[] = [
  { re: /\b(new delhi|delhi|ncr|दिल्ली|नई दिल्ली|দিল্লি)\b/i, city: 'Delhi' },
  { re: /\b(gurugram|gurgaon|गुरुग्राम|गुड़गांव)\b/i, city: 'Gurugram' },
  { re: /\b(noida|नोएडा|নোয়াডা)\b/i, city: 'Noida' },
  { re: /\b(greater noida|ग्रेटर नोएडा)\b/i, city: 'Greater Noida' },
  { re: /\b(ghaziabad|गाज़ियाबाद|गाजियाबाद)\b/i, city: 'Ghaziabad' },
  { re: /\b(mumbai|bombay|मुंबई|मुम्बई|মুম্বাই)\b/i, city: 'Mumbai' },
  { re: /\b(pune|पुणे|পুনে)\b/i, city: 'Pune' },
  { re: /\b(jaipur|जयपुर)\b/i, city: 'Jaipur' },
  { re: /\b(lucknow|लखनऊ|লখনউ)\b/i, city: 'Lucknow' },
  { re: /\b(kolkata|calcutta|कोलकाता|কলকাতা)\b/i, city: 'Kolkata' },
  { re: /\b(bengaluru|bangalore|बेंगलुरु|बंगलौर|বেঙ্গালুরু)\b/i, city: 'Bengaluru' },
  { re: /\b(chennai|madras|चेन्नई|চেন্নাই)\b/i, city: 'Chennai' },
  { re: /\b(ahmedabad|अहमदाबाद)\b/i, city: 'Ahmedabad' },
  { re: /\b(hyderabad|हैदराबाद|হায়দরাবাদ)\b/i, city: 'Hyderabad' },
  { re: /\b(bhubaneswar|भुवनेश्वर|ଭୁବନେଶ୍ୱର)\b/i, city: 'Bhubaneswar' },
  { re: /\b(kochi|cochin|कोच्चि|കൊച്ചി)\b/i, city: 'Kochi' },
];

/** City named in the message, if any (used to target the search). */
export function cityFromMessage(message: string): string | null {
  for (const alias of CITY_ALIASES) {
    if (alias.re.test(message)) return alias.city;
  }
  return null;
}

export function classifyIntent(message: string, options: ClassifyOptions = {}): IntentResult {
  const raw = message.trim();
  const text = raw.replace(/\s+/g, ' ');
  const signals: string[] = [];

  const mentionedHospitalTerms: string[] = [];
  for (const alias of HOSPITAL_ALIASES) {
    if (alias.term.test(text)) mentionedHospitalTerms.push(alias.id);
  }
  const uniqueHospitals = [...new Set(mentionedHospitalTerms)];

  let requestedLanguage: string | null = null;
  for (const { re, lang } of LANGUAGE_REQUESTS) {
    if (re.test(text)) {
      requestedLanguage = lang;
      signals.push(`language:${lang}`);
      break;
    }
  }

  // ── 1. Emergency first — never delayed by anything else ───────────────────
  for (const { re, label } of EMERGENCY_PATTERNS) {
    if (re.test(text)) {
      signals.push(`emergency:${label}`);
      const isBareWord = label.endsWith('emergency-word') && text.split(/\s+/).length <= 2;
      return {
        intent: 'emergency',
        confidence: isBareWord ? 0.7 : 0.95,
        allowHospitalTools: true,
        allowLocationPrompt: true,
        emergency: true,
        suggestedSpeciality: null,
        mentionedHospitalTerms: uniqueHospitals,
        requestedLanguage,
        signals,
      };
    }
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // ── 2. Pure greeting (short, no other content) ────────────────────────────
  if (GREETING_RE.test(text)) {
    signals.push('greeting:exact');
    return {
      intent: 'greeting',
      confidence: 0.98,
      allowHospitalTools: false,
      allowLocationPrompt: false,
      emergency: false,
      suggestedSpeciality: null,
      mentionedHospitalTerms: [],
      requestedLanguage,
      signals,
    };
  }

  // "hi, I need a hospital" is a search, not a greeting.
  const startsWithGreeting =
    /^(hi|hey|hello|namaste|namaskar|good (morning|afternoon|evening)|नमस्ते|नमस्कार)\b/i.test(text);
  const greetingOnlyPhrase = startsWithGreeting && wordCount <= 4 && !SEARCH_RE.test(text) && !TRAVEL_RE.test(text);

  if (greetingOnlyPhrase) {
    signals.push('greeting:leading');
    return {
      intent: 'greeting',
      confidence: 0.9,
      allowHospitalTools: false,
      allowLocationPrompt: false,
      emergency: false,
      suggestedSpeciality: null,
      mentionedHospitalTerms: [],
      requestedLanguage,
      signals,
    };
  }

  // ── 3. Thanks / closing ──────────────────────────────────────────────────
  if (THANKS_RE.test(text) || (wordCount <= 4 && /\b(thanks|thank you|shukriya|dhanyavad)\b/i.test(text))) {
    signals.push('thanks');
    return {
      intent: 'thanks',
      confidence: 0.98,
      allowHospitalTools: false,
      allowLocationPrompt: false,
      emergency: false,
      suggestedSpeciality: null,
      mentionedHospitalTerms: [],
      requestedLanguage,
      signals,
    };
  }

  if (CLOSING_RE.test(text) && wordCount <= 8 && !SEARCH_RE.test(text)) {
    signals.push('closing');
    return {
      intent: 'closing',
      confidence: 0.9,
      allowHospitalTools: false,
      allowLocationPrompt: false,
      emergency: false,
      suggestedSpeciality: null,
      mentionedHospitalTerms: [],
      requestedLanguage,
      signals,
    };
  }

  // ── 4. Identity / capability questions ───────────────────────────────────
  if (/\b(your name|who are you|what are you|what can you do|are you (a )?(bot|robot|human|ai|doctor))\b|आपका नाम|तुम्हारा नाम|कौन हो|তোমার নাম|నీ పేరు|तुमचे नाव|உங்கள் பெயர்|તમારું નામ|آپ کا نام|ನಿಮ್ಮ ಹೆಸರು|ଆପଣଙ୍କ ନାମ|നിങ്ങളുടെ പേര്/i.test(text)) {
    signals.push('identity');
    return {
      intent: 'identity',
      confidence: 0.95,
      allowHospitalTools: false,
      allowLocationPrompt: false,
      emergency: false,
      suggestedSpeciality: null,
      mentionedHospitalTerms: uniqueHospitals,
      requestedLanguage,
      signals,
    };
  }

  // ── 5. Guards: what we must not pretend to do ────────────────────────────
  if (UNSUPPORTED_RE.test(text)) {
    signals.push('unsupported');
    return {
      intent: 'unsupported',
      confidence: 0.9,
      allowHospitalTools: false,
      allowLocationPrompt: false,
      emergency: false,
      suggestedSpeciality: null,
      mentionedHospitalTerms: uniqueHospitals,
      requestedLanguage,
      signals,
    };
  }

  const wantsTravel = TRAVEL_RE.test(text);
  /**
   * A city name plus a hospital noun is a search: "government hospitals in
   * Kolkata", "hospitals in Kolkata", "Kolkata hospitals". Without this, a
   * named city with no "near me" wording fell through to health_info.
   */
  const namedCityForSearch = cityFromMessage(text);
  const wantsSearch =
    SEARCH_RE.test(text) ||
    (namedCityForSearch !== null &&
      /\b(hospitals?|clinics?|nursing home|icu|emergency|government|govt|private|सरकारी|निजी|হাসপাতাল|अस्पताल|মেডিকেল|medical college)\b/i.test(
        text,
      ));

  const wantsCompare = COMPARE_RE.test(text);
  const wantsHealth = HEALTH_RE.test(text);
  const wantsWebsite = WEBSITE_HELP_RE.test(text);

  let suggestedSpeciality: string | null = null;
  for (const hint of SPECIALITY_HINTS) {
    if (hint.re.test(text)) {
      suggestedSpeciality = hint.speciality;
      break;
    }
  }

  // ── 7b. Live-availability questions are never a hospital search ───────────
  // "is a doctor available at AIIMS today?" must be refused, not answered with
  // an OPD timetable we cannot verify.
  if (
    /\b(available|free|vacant|on duty|right now|today|waiting|wait time|queue)\b/i.test(text) &&
    /\b(beds?|icu|ventilator|oxygen|doctor|surgeon|specialist|opd|token)\b/i.test(text)
  ) {
    signals.push('live-availability-request');
    return {
      intent: 'unsupported',
      confidence: 0.85,
      allowHospitalTools: false,
      allowLocationPrompt: false,
      emergency: false,
      suggestedSpeciality,
      mentionedHospitalTerms: uniqueHospitals,
      requestedLanguage,
      signals,
    };
  }

  // ── 6. Hospital comparison ───────────────────────────────────────────────
  if (wantsCompare) {
    signals.push('compare');
    if (uniqueHospitals.length > 0) signals.push(`hospitals:${uniqueHospitals.length}`);
    return {
      intent: 'hospital_compare',
      confidence: uniqueHospitals.length >= 2 ? 0.95 : 0.8,
      allowHospitalTools: true,
      allowLocationPrompt: uniqueHospitals.length < 2,
      emergency: false,
      suggestedSpeciality,
      mentionedHospitalTerms: uniqueHospitals,
      requestedLanguage,
      signals,
    };
  }

  // ── 7. Location / travel ─────────────────────────────────────────────────
  if (wantsTravel || uniqueHospitals.length > 0) {
    signals.push(wantsTravel ? 'travel' : 'named-hospital');
    // "how far is X" / "distance to Y" / "nearest hospital" are all travel.
    if (wantsTravel || /\b(how far|distance|time|reach)\b/i.test(text) || uniqueHospitals.length > 0) {
      return {
        intent: 'location_travel',
        confidence: wantsTravel ? 0.92 : 0.78,
        allowHospitalTools: true,
        allowLocationPrompt: true,
        emergency: false,
        suggestedSpeciality,
        mentionedHospitalTerms: uniqueHospitals,
        requestedLanguage,
        signals,
      };
    }
  }

  // ── 8. Hospital discovery ────────────────────────────────────────────────
  if (wantsSearch) {
    signals.push('search');
    const asksForLocation = /\b(near me|nearby|near by|closest|nearest)\b|पास|नज़दीक|करीब/i.test(text);
    return {
      intent: 'hospital_search',
      confidence: asksForLocation ? 0.95 : 0.85,
      allowHospitalTools: true,
      allowLocationPrompt: true,
      emergency: false,
      suggestedSpeciality,
      mentionedHospitalTerms: uniqueHospitals,
      requestedLanguage,
      signals,
    };
  }

  // ── 9. General health question ───────────────────────────────────────────
  if (wantsHealth || suggestedSpeciality) {
    signals.push('health');
    return {
      intent: 'health_info',
      confidence: 0.85,
      allowHospitalTools: false,
      allowLocationPrompt: false,
      emergency: false,
      suggestedSpeciality,
      mentionedHospitalTerms: uniqueHospitals,
      requestedLanguage,
      signals,
    };
  }

  // ── 10. Website help ─────────────────────────────────────────────────────
  if (wantsWebsite) {
    signals.push('website-help');
    return {
      intent: 'website_help',
      confidence: 0.8,
      allowHospitalTools: false,
      allowLocationPrompt: false,
      emergency: false,
      suggestedSpeciality: null,
      mentionedHospitalTerms: uniqueHospitals,
      requestedLanguage,
      signals,
    };
  }

  // ── 11. Casual small talk ────────────────────────────────────────────────
  for (const re of CASUAL_PATTERNS) {
    if (re.test(text)) {
      signals.push('casual');
      return {
        intent: 'casual',
        confidence: 0.85,
        allowHospitalTools: false,
        allowLocationPrompt: false,
        emergency: false,
        suggestedSpeciality: null,
        mentionedHospitalTerms: uniqueHospitals,
        requestedLanguage,
        signals,
      };
    }
  }

  // ── 12. Follow-up that continues the previous topic ──────────────────────
  const history = options.history ?? [];
  if (history.length > 0 && (FOLLOWUP_RE.test(text) || wordCount <= 3)) {
    const previousUser = [...history].reverse().find((h) => h.role === 'user');
    if (previousUser) {
      const previous = classifyIntent(previousUser.text, { history: history.slice(0, -1) });
      if (previous.intent !== 'unknown' && previous.intent !== 'greeting') {
        signals.push(`followup:${previous.intent}`);
        return {
          intent: 'followup',
          confidence: 0.6,
          allowHospitalTools: previous.allowHospitalTools,
          allowLocationPrompt: previous.allowLocationPrompt,
          emergency: false,
          suggestedSpeciality: previous.suggestedSpeciality,
          mentionedHospitalTerms: uniqueHospitals.length > 0 ? uniqueHospitals : previous.mentionedHospitalTerms,
          requestedLanguage,
          signals,
        };
      }
    }
  }

  signals.push('unknown');
  return {
    intent: 'unknown',
    confidence: 0.3,
    allowHospitalTools: false,
    allowLocationPrompt: false,
    emergency: false,
    suggestedSpeciality,
    mentionedHospitalTerms: uniqueHospitals,
    requestedLanguage,
    signals,
  };
}

/** True when a tool may run for the given intent — the gate every tool call passes. */
export function mayRunHospitalTools(result: IntentResult): boolean {
  return result.allowHospitalTools === true && result.confidence >= 0.6;
}

export function mayPromptForLocation(result: IntentResult): boolean {
  return result.allowLocationPrompt === true && result.confidence >= 0.6;
}
