import { HOSPITALS } from '@/data/hospitals';
import { TREATMENTS } from '@/data/treatments';
import { estimateTreatment } from './cost-estimate';
import { formatRange } from './format';
import { estimateTravelMetrics, formatDistance, formatDuration } from './geo';
import { Lang } from './lang-meta';
import { computeCommunityScore, getAllReviews } from './ratings';
import { specialityForProblem } from './recommend';

export interface ChatHospitalCard {
  id: string;
  name: string;
  shortName: string;
  type: 'government' | 'private';
  city: string;
  roadKm: number;
  etaMinutes: number;
  phone: string | null;
  emergency: string;
  imdbScore: number | null;
}

export interface ChatResponsePayload {
  reply: string;
  recommendedHospitals: ChatHospitalCard[];
  costEstimate?: {
    treatmentName: string;
    govtRange: string;
    privateRange: string;
    note?: string;
  };
  groundingMode: 'llm-grounded' | 'deterministic-grounded';
  disclaimer: string;
}

const CHAT_DISCLAIMERS: Record<Lang, string> = {
  en: 'Information grounded in JeevanSetu’s public dataset & indicative CGHS/PM-JAY ranges — NOT medical advice. In an emergency, call 112 immediately.',
  hi: 'यह जानकारी JeevanSetu के सार्वजनिक डेटा और CGHS/PM-JAY अनुमानों पर आधारित है — चिकित्सा सलाह नहीं। आपात स्थिति में तुरंत 112 पर कॉल करें।',
  bn: 'এই তথ্য JeevanSetu-এর যাচাইকৃত পাবলিক ডেটা ও CGHS/PM-JAY আনুমানিক খরচের ওপর ভিত্তি করে — চিকিৎসা পরামর্শ নয়। জরুরি অবস্থায় 112 কল করুন।',
  te: 'ఈ సమాచారం JeevanSetu డేటా మరియు CGHS/PM-JAY అంచనాలపై ఆధారపడి ఉంది — వైద్య సలహా కాదు. అత్యవసరమైతే 112 కి కాల్ చేయండి.',
  mr: 'ही माहिती JeevanSetu च्या सार्वजनिक डेटा आणि CGHS/PM-JAY अंदाजांवर आधारित आहे — वैद्यकीय सल्ला नाही. आणीबाणीत 112 वर कॉल करा.',
  ta: 'இந்தத் தகவல் JeevanSetu தரவு மற்றும் CGHS/PM-JAY மதிப்பீடுகளின் அடிப்படையிலானது — மருத்துவ ஆலோசனை அல்ல. அவசரத்திற்கு 112 அழைக்கவும்.',
  gu: 'આ માહિતી JeevanSetu ના જાહેર ડેટા અને CGHS/PM-JAY અંદાજો પર આધારિત છે — તબીબી સલાહ નથી. કટોકટીમાં 112 પર કૉલ કરો.',
  ur: 'یہ معلومات JeevanSetu کے عوامی ڈیٹا اور CGHS/PM-JAY تخمینوں پر مبنی ہیں — طبی مشورہ نہیں۔ ایمرجنسی میں فوراً 112 پر کال کریں۔',
  kn: 'ಈ ಮಾಹಿತಿಯು JeevanSetu ಸಾರ್ವಜನಿಕ ಡೇಟಾ ಮತ್ತು CGHS/PM-JAY ಅಂದಾಜುಗಳನ್ನಾಧರಿಸಿದೆ — ವೈದ್ಯಕೀಯ ಸಲಹೆಯಲ್ಲ. ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಲ್ಲಿ 112 ಕರೆ ಮಾಡಿ.',
  or: 'ଏହି ସୂଚନା JeevanSetu ତଥ୍ୟ ଓ CGHS/PM-JAY ଆକଳନ ଉପରେ ଆଧାରିତ — ଡାକ୍ତରୀ ପରାମର୍ଶ ନୁହେଁ। ଜରୁରୀ ଅବସ୍ଥାରେ 112 କଲ୍ କରନ୍ତୁ।',
  ml: 'ഈ വിവരങ്ങൾ JeevanSetu ഡാറ്റയും CGHS/PM-JAY നിരക്കുകളും അടിസ്ഥാനമാക്കിയുള്ളതാണ് — വൈദ്യോപദേശമല്ല. അത്യാഹിതത്തിൽ 112-ൽ വിളിക്കുക.',
};

const GOVT_KEYWORDS = /government|govt|public|sarkari|सरकारी|সরকারি|ప్రభుత్వ|सरकारी|அரசு|સરકારી|سرکاری|ಸರ್ಕಾರಿ|ସରକାରୀ|സർക്കാർ|free|subsid/i;
const PRIVATE_KEYWORDS = /private|corporate|निजी|বেসরকারি|ప్రైవేట్|खाजगी|தனியார்|ખાનગી|نجی|ಖಾಸಗಿ|ବେସରକାରୀ|സ്വകാര്യം/i;
const EMERGENCY_KEYWORDS = /emergency|urgent|accident|trauma|ambulance|112|heart attack|stroke|bleeding|आपात|জরুরি|అత్యవసర|आणीबाणी|அவசர|કટોકટી|ایمرجنسی|ತುರ್ತು|ଜରୁରୀ|അത്യാഹിത/i;
const COST_KEYWORDS = /cost|price|charge|fee|bill|estimate|rupee|₹|खर्च|लागत|খরচ|ఖర్చు|खर्च|செலவு|ખર્ચ|خرچ|ವೆಚ್ಚ|ଖର୍ଚ୍ଚ|ചെലവ്/i;
const ETA_KEYWORDS = /time|eta|far|distance|reach|drive|traffic|travel|कितना समय|दूरी|সময়|কত দূর|దూరం|సమయం|वेळ|अंतर|நேரம்|தூரம்|સમય|અંતર|وقت|فاصلہ|ಸಮಯ|ದೂರ|ସମୟ|ଦୂରତା|സമയം|ദൂരം/i;
const UNSUPPORTED_QUERY_KEYWORDS = /prescribe|dosage|mg\b|tablet name|which medicine should i take|cure guarantee|doctor mobile|live bed availability|available icu bed right now/i;

function matchTreatmentFromMessage(msg: string) {
  const lower = msg.toLowerCase();
  const pairs: { re: RegExp; id: string }[] = [
    { re: /c-section|caesarean|cesarean|सिज़ेरियन|সিজার|సిజేరియన్/i, id: 'caesarean' },
    { re: /delivery|maternity|birth|प्रसव|डिलीवरी|প্রসব|प्रसूती|பிரசவம்/i, id: 'normal-delivery' },
    { re: /cataract|मोतियाबिंद|ছানি/i, id: 'cataract' },
    { re: /angioplasty|stent|heart surgery|एंजियोप्लास्टी|স্টেন্ট/i, id: 'angioplasty' },
    { re: /dialysis|डायलिसिस|ডায়ালিসিস/i, id: 'dialysis-session' },
    { re: /mri|एमआरआई/i, id: 'mri' },
    { re: /x-ray|xray|एक्स-रे/i, id: 'chest-xray' },
    { re: /ultrasound|sonography|अल्ट्रासाउंड/i, id: 'ultrasound' },
    { re: /ecg|ईसीजी/i, id: 'ecg' },
    { re: /cbc|blood test|खून की जांच|রক্ত পরীক্ষা/i, id: 'cbc-test' },
    { re: /appendix|appendectomy|अपेंडिक्स/i, id: 'appendectomy' },
    { re: /hernia|हर्निया/i, id: 'hernia-repair' },
    { re: /fracture|plaster|फ्रैक्चर/i, id: 'fracture-minor' },
    { re: /dengue|डेंगू|ডেঙ্গু/i, id: 'dengue-admit' },
    { re: /typhoid|टाइफाइड/i, id: 'typhoid' },
    { re: /knee|घुटना/i, id: 'knee-replacement' },
    { re: /chemo|cancer|कीमोथेरेपी|कैंसर|ক্যান্সার/i, id: 'chemotherapy' },
    { re: /consult|opd|fever|परामर्श|बुखार|জ্বর/i, id: 'general-consultation' },
  ];
  for (const p of pairs) {
    if (p.re.test(lower)) {
      return TREATMENTS.find((t) => t.id === p.id);
    }
  }
  return undefined;
}

function localizedHeader(lang: Lang, kind: 'emergency' | 'unsupported' | 'hospitals' | 'costOnly'): string {
  const map: Record<Lang, Record<typeof kind, string>> = {
    en: {
      emergency: '⚠️ If this is a life-threatening emergency, call 112 (or 108 ambulance) immediately. Nearest verified 24×7 emergency hospitals from your location:',
      unsupported: 'I cannot prescribe medicines, confirm live ICU bed counts, or invent unverified hospital information. Here is verified information from JeevanSetu’s dataset:',
      hospitals: 'Here are matching hospitals from JeevanSetu’s dataset near your selected location:',
      costOnly: 'Here is the indicative cost range from JeevanSetu’s public CGHS / PM-JAY / published tariff references:',
    },
    hi: {
      emergency: '⚠️ यदि यह गंभीर आपात स्थिति है, तो तुरंत 112 (या 108 एम्बुलेंस) पर कॉल करें। आपकी लोकेशन के सबसे नज़दीकी सत्यापित 24×7 आपातकालीन अस्पताल:',
      unsupported: 'मैं दवाइयां लिखने, लाइव खाली बेड की संख्या बताने या असत्यापित जानकारी का अंदाज़ा लगाने में असमर्थ हूं। JeevanSetu डेटासेट के अनुसार उपलब्ध जानकारी नीचे है:',
      hospitals: 'आपकी चुनी गई लोकेशन के पास JeevanSetu डेटासेट से उपयुक्त अस्पताल यहां दिए गए हैं:',
      costOnly: 'सार्वजनिक CGHS / PM-JAY / प्रकाशित शुल्क संदर्भों के अनुसार अनुमानित खर्च सीमा:',
    },
    bn: {
      emergency: '⚠️ এটি জীবন-সংকটাপন্ন জরুরি অবস্থা হলে অবিলম্বে 112 নম্বরে কল করুন। আপনার অবস্থানের নিকটবর্তী যাচাইকৃত ২৪×৭ জরুরি হাসপাতাল:',
      unsupported: 'আমি ওষুধের প্রেসক্রিপশন দিতে বা লাইভ খালি বেডের সংখ্যা অনুমান করতে পারি না। আমাদের যাচাইকৃত তালিকা অনুযায়ী তথ্য নিচে দেওয়া হলো:',
      hospitals: 'আপনার নির্বাচিত অবস্থানের কাছে JeevanSetu তালিকাভুক্ত হাসপাতালগুলো নিচে দেওয়া হলো:',
      costOnly: 'সরকারি CGHS / PM-JAY ও প্রকাশিত তালিকা অনুযায়ী আনুমানিক চিকিৎসার খরচ:',
    },
    te: {
      emergency: '⚠️ ఇది ప్రాణాపాయ అత్యవసర పరిస్థితి అయితే వెంటనే 112 కి కాల్ చేయండి. మీకు సమీపంలోని ధృవీకరించబడిన 24×7 అత్యవసర ఆసుపత్రులు:',
      unsupported: 'నేను మందులను సూచించలేను లేదా ధృవీకరించని సమాచారాన్ని ఊహించలేను. JeevanSetu డేటా ప్రకారం అందుబాటులో ఉన్న వివరాలు:',
      hospitals: 'మీ ఎంచుకున్న లొకేషన్ సమీపంలో JeevanSetu డేటాలోని ఆసుపత్రులు:',
      costOnly: 'పబ్లిక్ CGHS / PM-JAY సూచనల ఆధారంగా అంచనా చికిత్స ఖర్చు:',
    },
    mr: {
      emergency: '⚠️ ही गंभीर आणीबाणी असल्यास तात्काळ 112 वर कॉल करा. तुमच्या जवळील पडताळलेली २४×७ आपत्कालीन रुग्णालये:',
      unsupported: 'मी औषधे सुचवू शकत नाही किंवा अपडताळलेली माहिती सांगू शकत नाही. JeevanSetu डेटासेटमधील उपलब्ध माहिती खालीलप्रमाणे आहे:',
      hospitals: 'तुमच्या निवडलेल्या ठिकाणाजवळील JeevanSetu यादीतील रुग्णालये:',
      costOnly: 'सार्वजनिक CGHS / PM-JAY संदर्भांनुसार उपचाराचा अंदाजे खर्च:',
    },
    ta: {
      emergency: '⚠️ இது உயிருக்கு ஆபத்தான அவசரநிலை என்றால் உடனே 112 ஐ அழைக்கவும். உங்கள் இருப்பிடத்திற்கு அருகிலுள்ள சரிபார்க்கப்பட்ட 24×7 அவசர மருத்துவமனைகள்:',
      unsupported: 'மருந்துகளை பரிந்துரைக்கவோ அல்லது சரிபார்க்கப்படாத தகவல்களை உருவாக்கவோ என்னால் முடியாது. JeevanSetu தரவின்படி விவரங்கள் இதோ:',
      hospitals: 'உங்கள் இருப்பிடத்திற்கு அருகிலுள்ள JeevanSetu பட்டியலிடப்பட்ட மருத்துவமனைகள்:',
      costOnly: 'CGHS / PM-JAY பொது ஆதாரங்களின்படி உத்தேச சிகிச்சை செலவு:',
    },
    gu: {
      emergency: '⚠️ જો આ ગંભીર કટોકટી હોય તો તરત જ 112 પર કૉલ કરો. તમારા સ્થાનની નજીકની ચકાસાયેલ 24×7 ઇમરજન્સી હોસ્પિટલો:',
      unsupported: 'હું દવાઓ લખી શકતો નથી કે અચકાસાયેલ માહિતી બનાવી શકતો નથી. JeevanSetu ડેટાસેટ મુજબ ઉપલબ્ધ માહિતી:',
      hospitals: 'તમારા પસંદ કરેલા સ્થાન નજીક JeevanSetu યાદીમાંની હોસ્પિટલો:',
      costOnly: 'જાહેર CGHS / PM-JAY સંદર્ભો મુજબ અંદાજિત સારવાર ખર્ચ:',
    },
    ur: {
      emergency: '⚠️ اگر یہ جان لیوا ایمرجنسی ہے تو فوراً 112 پر کال کریں۔ آپ کے مقام کے قریب تصدیق شدہ 24×7 ایمرجنسی اسپتال:',
      unsupported: 'میں ادویات تجویز نہیں کر سکتا اور نہ ہی غیر مصدقہ معلومات گھڑ سکتا ہوں۔ JeevanSetu ڈیٹا کے مطابق دستیاب معلومات درج ذیل ہیں:',
      hospitals: 'آپ کے منتخب کردہ مقام کے قریب JeevanSetu میں درج اسپتال:',
      costOnly: 'عوامی CGHS / PM-JAY حوالہ جات کے مطابق متوقع علاج کا خرچ:',
    },
    kn: {
      emergency: '⚠️ ಇದು ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಾಗಿದ್ದರೆ ತಕ್ಷಣ 112 ಗೆ ಕರೆ ಮಾಡಿ. ನಿಮ್ಮ ಸ್ಥಳದ ಸಮೀಪದ ಪರಿಶೀಲಿತ 24×7 ತುರ್ತು ಆಸ್ಪತ್ರೆಗಳು:',
      unsupported: 'ನಾನು ಔಷಧಿಗಳನ್ನು ಶಿಫಾರಸು ಮಾಡಲು ಅಥವಾ ಅಪರಿಶೀಲಿತ ಮಾಹಿತಿಯನ್ನು ಊಹಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. JeevanSetu ಡೇಟಾದಲ್ಲಿ ಲಭ್ಯವಿರುವ ವಿವರಗಳು:',
      hospitals: 'ನಿಮ್ಮ ಆಯ್ದ ಸ್ಥಳದ ಸಮೀಪವಿರುವ JeevanSetu ಪಟ್ಟಿಯ ಆಸ್ಪತ್ರೆಗಳು:',
      costOnly: 'ಸಾರ್ವಜನಿಕ CGHS / PM-JAY ಉಲ್ಲೇಖಗಳ ಪ್ರಕಾರ ಅಂದಾಜು ಚಿಕಿತ್ಸಾ ವೆಚ್ಚ:',
    },
    or: {
      emergency: '⚠️ ଯଦି ଏହା ଜରୁରୀ ପରିସ୍ଥିତି ଅଟେ, ତୁରନ୍ତ 112 କୁ କଲ୍ କରନ୍ତୁ। ଆପଣଙ୍କ ନିକଟସ୍ଥ ଯାଞ୍ଚ ହୋଇଥିବା ୨୪×୭ ଜରୁରୀ ଡାକ୍ତରଖାନା:',
      unsupported: 'ମୁଁ ଔଷଧ ପରାମର୍ଶ ଦେଇପାରିବି ନାହିଁ କିମ୍ବା ଅଯାଞ୍ଚିତ ତଥ୍ୟ ଅନୁମାନ କରିପାରିବି ନାହିଁ। JeevanSetu ତଥ୍ୟ ଅନୁଯାୟୀ ବିବରଣୀ:',
      hospitals: 'ଆପଣଙ୍କ ସ୍ଥାନ ନିକଟରେ ଥିବା JeevanSetu ତାଲିକାଭୁକ୍ତ ଡାକ୍ତରଖାନାଗୁଡ଼ିକ:',
      costOnly: 'ସରକାରୀ CGHS / PM-JAY ଆଧାରରେ ଆନୁମାନିକ ଚିକିତ୍ସା ଖର୍ଚ୍ଚ:',
    },
    ml: {
      emergency: '⚠️ ഇത് ജീവന് ഭീഷണിയായ അത്യാഹിതമാണെങ്കിൽ ഉടൻ 112-ൽ വിളിക്കുക. നിങ്ങളുടെ സ്ഥാനത്തിന് അടുത്തുള്ള സ്ഥിരീകരിച്ച 24×7 എമർജൻസി ആശുപത്രികൾ:',
      unsupported: 'മരുന്നുകൾ നിർദ്ദേശിക്കാനോ സ്ഥിരീകരിക്കാത്ത വിവരങ്ങൾ ഊഹിച്ചു പറയാനോ എനിക്ക് കഴിയില്ല. JeevanSetu ഡാറ്റ പ്രകാരമുള്ള വിവരങ്ങൾ:',
      hospitals: 'നിങ്ങളുടെ സ്ഥാനത്തിന് അടുത്തുള്ള JeevanSetu ലിസ്റ്റിലെ ആശുപത്രികൾ:',
      costOnly: 'പൊതു CGHS / PM-JAY നിരക്കുകൾ പ്രകാരമുള്ള ഏകദേശ ചികിത്സാ ചെലവ്:',
    },
  };
  return map[lang]?.[kind] ?? map.en[kind];
}

export async function generateGroundedChatReply(params: {
  message: string;
  lang: Lang;
  lat: number;
  lng: number;
  focusedHospitalId?: string;
}): Promise<ChatResponsePayload> {
  const { message, lang, lat, lng, focusedHospitalId } = params;
  const trimmed = message.trim();
  const allReviews = getAllReviews();

  const wantsGovt = GOVT_KEYWORDS.test(trimmed) && !PRIVATE_KEYWORDS.test(trimmed);
  const wantsPrivate = PRIVATE_KEYWORDS.test(trimmed) && !GOVT_KEYWORDS.test(trimmed);
  const isEmergency = EMERGENCY_KEYWORDS.test(trimmed);
  const isUnsupported = UNSUPPORTED_QUERY_KEYWORDS.test(trimmed);
  const wantsCost = COST_KEYWORDS.test(trimmed);
  const wantsEta = ETA_KEYWORDS.test(trimmed);
  const mappedSpec = specialityForProblem(trimmed);

  // Check if user mentioned a specific hospital name or has a focusedHospitalId
  const lower = trimmed.toLowerCase();
  const namedHospital =
    HOSPITALS.find(
      (h) =>
        lower.includes(h.shortName.toLowerCase()) ||
        lower.includes(h.id.replace(/-/g, ' ')) ||
        (h.id === 'aiims-new-delhi' && /\baiims\b/i.test(lower) && !/bhubaneswar/i.test(lower)),
    ) ?? (focusedHospitalId ? HOSPITALS.find((h) => h.id === focusedHospitalId) : undefined);

  // Rank candidate hospitals around user's origin
  let pool = HOSPITALS.map((h) => {
    const travel = estimateTravelMetrics(lat, lng, h.lat, h.lng);
    const comm = computeCommunityScore(h.id, allReviews);
    return {
      hospital: h,
      roadKm: travel.roadKm,
      etaMinutes: travel.trafficMinutes,
      imdbScore: comm.imdbScaleScore,
    };
  });

  if (wantsGovt) pool = pool.filter((x) => x.hospital.type === 'government');
  if (wantsPrivate) pool = pool.filter((x) => x.hospital.type === 'private');
  if (isEmergency) pool = pool.filter((x) => x.hospital.emergency === 'verified');
  if (mappedSpec) pool = pool.filter((x) => x.hospital.specialities.includes(mappedSpec));

  pool.sort((a, b) => a.roadKm - b.roadKm);

  const selectedList = namedHospital
    ? [
        pool.find((p) => p.hospital.id === namedHospital.id) ?? {
          hospital: namedHospital,
          roadKm: estimateTravelMetrics(lat, lng, namedHospital.lat, namedHospital.lng).roadKm,
          etaMinutes: estimateTravelMetrics(lat, lng, namedHospital.lat, namedHospital.lng).trafficMinutes,
          imdbScore: computeCommunityScore(namedHospital.id, allReviews).imdbScaleScore,
        },
        ...pool.filter((p) => p.hospital.id !== namedHospital.id).slice(0, 2),
      ]
    : pool.slice(0, 3);

  const cards: ChatHospitalCard[] = selectedList.map((item) => ({
    id: item.hospital.id,
    name: item.hospital.name,
    shortName: item.hospital.shortName,
    type: item.hospital.type,
    city: item.hospital.city,
    roadKm: item.roadKm,
    etaMinutes: item.etaMinutes,
    phone: item.hospital.phone,
    emergency: item.hospital.emergency,
    imdbScore: item.imdbScore,
  }));

  // Treatment cost lookup
  const matchedTreatment = matchTreatmentFromMessage(trimmed) ?? (wantsCost ? TREATMENTS[0] : undefined);
  let costEstimate: ChatResponsePayload['costEstimate'] | undefined;
  if (matchedTreatment) {
    const est = estimateTreatment(
      matchedTreatment,
      {
        treatmentId: matchedTreatment.id,
        includedTests: matchedTreatment.tests.map((_, i) => i),
        stayDays: matchedTreatment.roomPerDay ? Math.max(1, matchedTreatment.typicalStayDays[0]) : 0,
        roomType: 'general',
      },
      lang,
    );
    costEstimate = {
      treatmentName: lang === 'hi' && matchedTreatment.hindiName ? matchedTreatment.hindiName : matchedTreatment.name,
      govtRange: formatRange(est.govtTotal[0], est.govtTotal[1]),
      privateRange: formatRange(est.privateTotal[0], est.privateTotal[1]),
      note: matchedTreatment.note,
    };
  }

  // Optional external LLM enrichment if OPENAI_API_KEY or GEMINI_API_KEY is configured
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    try {
      const groundingContext = JSON.stringify({
        userLanguage: lang,
        hospitals: cards,
        costEstimate,
      });
      const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 280,
          messages: [
            {
              role: 'system',
              content:
                'You are the JeevanSetu Healthcare Assistant. Respond strictly in the user language code requested. ONLY use numbers, hospitals, distances, ETAs, and cost ranges provided in GROUNDING_DATA. Never invent doctors, bed counts, live traffic incidents, or medical prescriptions. Remind users to call 112 for emergencies.',
            },
            {
              role: 'user',
              content: `GROUNDING_DATA: ${groundingContext}\n\nUSER_QUESTION: ${trimmed}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(4500),
      });
      if (llmRes.ok) {
        const data = await llmRes.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) {
          return {
            reply: text,
            recommendedHospitals: cards,
            costEstimate,
            groundingMode: 'llm-grounded',
            disclaimer: CHAT_DISCLAIMERS[lang] ?? CHAT_DISCLAIMERS.en,
          };
        }
      }
    } catch {
      // Fall through cleanly to deterministic grounded response
    }
  }

  // Deterministic grounded response builder
  const lines: string[] = [];
  if (isUnsupported) {
    lines.push(localizedHeader(lang, 'unsupported'));
  } else if (isEmergency) {
    lines.push(localizedHeader(lang, 'emergency'));
  } else if (wantsCost && !wantsGovt && !wantsPrivate && !wantsEta && !namedHospital && !mappedSpec) {
    lines.push(localizedHeader(lang, 'costOnly'));
  } else {
    lines.push(localizedHeader(lang, 'hospitals'));
  }

  if (namedHospital && (wantsEta || wantsCost || cards.length > 0)) {
    const top = cards[0];
    lines.push(
      `• ${top.name} (${top.city}): ~${formatDistance(top.roadKm, lang)} · ~${formatDuration(top.etaMinutes, lang)} (indicative urban traffic ETA).`,
    );
  } else {
    for (const c of cards) {
      lines.push(
        `• ${c.shortName} (${c.city}) — ${formatDistance(c.roadKm, lang)}, ~${formatDuration(c.etaMinutes, lang)}${c.imdbScore ? ` · Score ${c.imdbScore}/10` : ''}`,
      );
    }
  }

  if (costEstimate) {
    lines.push(
      `₹ ${costEstimate.treatmentName}: Govt ${costEstimate.govtRange} | Private ${costEstimate.privateRange} (indicative CGHS/PM-JAY/published tariff range, not a binding quote).`,
    );
  }

  return {
    reply: lines.join('\n'),
    recommendedHospitals: cards,
    costEstimate,
    groundingMode: 'deterministic-grounded',
    disclaimer: CHAT_DISCLAIMERS[lang] ?? CHAT_DISCLAIMERS.en,
  };
}
