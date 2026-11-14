import type { Lang } from '@/lib/lang-meta';

/**
 * Conversational copy for JeevanSetu AI Assistant.
 *
 * Design intent (requirement 5.1): short, human, and never pushy. A greeting
 * gets a greeting. It must never become "Here are the nearest hospitals."
 *
 * English and Hindi are fully authored. Other languages fall back to English
 * key-by-key, which is honest (the assistant states which language it is
 * answering in) rather than shipping unverified medical phrasing.
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

export interface AssistantCopy {
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
  greetingNight: string;
  greetingBack: string;
  greetingFirst: string;
  casualWell: string;
  casualAskHelp: string;
  identity: string;
  thanks: string;
  thanksLong: string;
  closing: string;
  closingCare: string;
  healthAcknowledge: string;
  healthAcknowledgeGeneric: string;
  healthFollowUp: string;
  emergencyHeadline: string;
  emergencyAction: string;
  emergencyOfferNav: string;
  hospitalAskLocation: string;
  hospitalAskLocationDenied: string;
  compareAskWhich: string;
  compareIntro: string;
  travelAskPermission: string;
  travelNeedOrigin: string;
  websiteHelp: string;
  unsupported: string;
  unknown: string;
  disclaimer: string;
  voiceUnsupported: string;
  askCity: string;
  /** Explicit refusal for prescriptions / dosages / diagnoses (requirement 7). */
  medicalRefusal: string;
  /** Explicit refusal for live data we cannot see (ICU beds, doctor rosters). */
  liveDataRefusal: string;
}

const EN: AssistantCopy = {
  greetingMorning: 'Good morning! How are you today?',
  greetingAfternoon: 'Hello! How can I help you?',
  greetingEvening: 'Good evening! How are you doing?',
  greetingNight: 'Hi! How can I help you?',
  greetingBack: 'Welcome back! How can I help?',
  greetingFirst: 'Hi! How are you doing today?',
  casualWell: "I'm doing well, thank you! How can I help?",
  casualAskHelp: 'I am here and ready to help — what would you like to know?',
  identity:
    "I'm JeevanSetu AI Assistant. I can help with general health information, hospitals, and navigating JeevanSetu.",
  thanks: "You're welcome! Take care.",
  thanksLong: "You're very welcome. If anything else comes up, I'm here.",
  closing: 'Take care — and call 112 straight away if this ever becomes an emergency.',
  closingCare: 'Goodbye, and take care of yourself.',
  healthAcknowledge: "I'm sorry you're dealing with that.",
  healthAcknowledgeGeneric: 'Thanks for telling me.',
  healthFollowUp: 'When did it start, and is it mild or severe?',
  emergencyHeadline:
    'Severe chest pain with breathing difficulty can be an emergency. Please call 112 in India or seek urgent emergency medical care now.',
  emergencyAction:
    'Call 112 now. If you can, ask someone to stay with you and keep your phone unlocked.',
  emergencyOfferNav: 'I can show you the nearest 24×7 emergency hospitals while you call.',
  hospitalAskLocation: 'Sure. Would you like me to use your current location, or would you prefer to enter an area?',
  hospitalAskLocationDenied:
    'I need a starting point to calculate distances. You can type an area, a PIN code, or pick a city — I will not guess your location.',
  compareAskWhich: 'Happy to compare. Which two hospitals are you considering?',
  compareIntro: "Here's what JeevanSetu's data can and cannot tell you about these two.",
  travelAskPermission: 'May I use your current location to calculate the driving distance?',
  travelNeedOrigin:
    'I need a starting point first. Share your location, type an area or PIN code, and I will pull the real Google driving distance.',
  websiteHelp:
    'JeevanSetu has hospital search, side-by-side comparison, a treatment-cost estimator, rankings, emergency help, and me. Where would you like to start?',
  unsupported:
    "I'm not able to help with that one. I can share general health information, find hospitals, compare facilities and estimate travel times — but I can't diagnose, prescribe, or confirm live bed availability.",
  unknown: "Could you tell me a little more about what you need?",
  disclaimer:
    'General information only — not a diagnosis or prescription. For emergencies call 112 immediately.',
  voiceUnsupported: 'Voice input is not supported in this browser. You can type instead.',
  askCity: 'Which area, city or PIN code should I use as the starting point?',
  medicalRefusal:
    'I cannot prescribe medicine, suggest a dose or diagnose a condition — that needs a qualified doctor who can examine you. I can help you find the right hospital or department, and for anything urgent please call 112 or go to the nearest emergency department.',
  liveDataRefusal:
    'I do not have access to live bed, ICU or doctor-availability data for this hospital, so I will not guess a number. Real-time availability is only available by calling the hospital desk directly — I can show you the phone number, the address and the driving route instead.',
};

const HI: AssistantCopy = {
  greetingMorning: 'सुप्रभात! आप कैसे हैं?',
  greetingAfternoon: 'नमस्ते! मैं कैसे मदद कर सकता हूं?',
  greetingEvening: 'शुभ संध्या! आप कैसे हैं?',
  greetingNight: 'नमस्ते! मैं कैसे मदद कर सकता हूं?',
  greetingBack: 'फिर से स्वागत है! मैं कैसे मदद कर सकता हूं?',
  greetingFirst: 'नमस्ते! आप आज कैसे हैं?',
  casualWell: 'मैं ठीक हूं, धन्यवाद! मैं आपकी क्या मदद कर सकता हूं?',
  casualAskHelp: 'मैं यहां हूं और मदद के लिए तैयार हूं — आप क्या जानना चाहेंगे?',
  identity: 'मैं JeevanSetu AI सहायक हूं। मैं सामान्य स्वास्थ्य जानकारी, अस्पताल और JeevanSetu के उपयोग में मदद कर सकता हूं।',
  thanks: 'आपका स्वागत है! अपना ध्यान रखें।',
  thanksLong: 'आपका बहुत स्वागत है। कुछ और हो तो मैं यहीं हूं।',
  closing: 'अपना ध्यान रखें — और अगर कभी आपात स्थिति हो तो तुरंत 112 पर कॉल करें।',
  closingCare: 'अलविदा, अपना ख्याल रखें।',
  healthAcknowledge: 'मुझे सुनकर दुख हुआ।',
  healthAcknowledgeGeneric: 'बताने के लिए धन्यवाद।',
  healthFollowUp: 'यह कब शुरू हुआ, और हल्का है या तेज़?',
  emergencyHeadline:
    'तेज़ सीने में दर्द और सांस लेने में कठिनाई आपात स्थिति हो सकती है। कृपया अभी 112 पर कॉल करें या तुरंत आपातकालीन चिकित्सा सहायता लें।',
  emergencyAction: 'अभी 112 पर कॉल करें। यदि संभव हो तो किसी को अपने पास रखें और फ़ोन अनलॉक रखें।',
  emergencyOfferNav: 'कॉल करते समय मैं आपको नज़दीकी 24×7 आपातकालीन अस्पताल दिखा सकता हूं।',
  hospitalAskLocation: 'ज़रूर। क्या मैं आपकी वर्तमान लोकेशन उपयोग करूं, या आप इलाका बताना चाहेंगे?',
  hospitalAskLocationDenied:
    'दूरी गिनने के लिए मुझे शुरुआती जगह चाहिए। आप इलाका, पिन कोड या शहर लिख सकते हैं — मैं लोकेशन का अनुमान नहीं लगाऊंगा।',
  compareAskWhich: 'तुलना करके खुशी होगी। आप किन दो अस्पतालों पर विचार कर रहे हैं?',
  compareIntro: 'JeevanSetu का डेटा इन दोनों के बारे में क्या बता सकता है और क्या नहीं, यह रहा।',
  travelAskPermission: 'क्या मैं सड़क दूरी निकालने के लिए आपकी वर्तमान लोकेशन उपयोग कर सकता हूं?',
  travelNeedOrigin:
    'पहले शुरुआती जगह चाहिए। लोकेशन साझा करें, इलाका या पिन कोड लिखें — मैं असली Google सड़क दूरी निकालूंगा।',
  websiteHelp:
    'JeevanSetu में अस्पताल खोज, तुलना, इलाज खर्च अनुमान, रैंकिंग, आपात सहायता और मैं — सब उपलब्ध है। कहां से शुरू करें?',
  unsupported:
    'इसमें मैं मदद नहीं कर सकता। मैं सामान्य स्वास्थ्य जानकारी, अस्पताल खोज, तुलना और यात्रा समय बता सकता हूं — लेकिन निदान, दवा या लाइव बेड उपलब्धता की पुष्टि नहीं कर सकता।',
  unknown: 'क्या आप थोड़ा और बता सकते हैं कि आपको क्या चाहिए?',
  disclaimer: 'केवल सामान्य जानकारी — कोई निदान या पर्चा नहीं। आपात स्थिति में तुरंत 112 पर कॉल करें।',
  voiceUnsupported: 'इस ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। आप टाइप कर सकते हैं।',
  askCity: 'शुरुआती जगह के लिए कौन सा इलाका, शहर या पिन कोड लें?',
  medicalRefusal:
    'मैं दवा नहीं बता सकता, खुराक नहीं सुझा सकता और बीमारी का निदान नहीं कर सकता — इसके लिए योग्य डॉक्टर ज़रूरी है जो आपकी जांच कर सके। मैं सही अस्पताल या विभाग खोजने में मदद कर सकता हूं, और किसी भी आपात स्थिति में तुरंत 112 पर कॉल करें।',
  liveDataRefusal:
    'मेरे पास इस अस्पताल के बेड, आईसीयू या डॉक्टर की उपलब्धता का लाइव डेटा नहीं है, इसलिए मैं अनुमान नहीं लगाऊंगा। असली उपलब्धता के लिए अस्पताल डेस्क पर कॉल करें — मैं फ़ोन नंबर, पता और ड्राइविंग रूट दिखा सकता हूं।',
};

const OVERRIDES: Record<Exclude<Lang, 'en' | 'hi'>, Partial<AssistantCopy>> = {
  bn: {
    greetingMorning: 'সুপ্রভাত! আপনি কেমন আছেন?',
    greetingAfternoon: 'নমস্কার! আমি কীভাবে সাহায্য করতে পারি?',
    greetingEvening: 'শুভ সন্ধ্যা! আপনি কেমন আছেন?',
    greetingNight: 'নমস্কার! আমি কীভাবে সাহায্য করতে পারি?',
    casualWell: 'আমি ভালো আছি, ধন্যবাদ! আমি কীভাবে সাহায্য করতে পারি?',
    identity:
      'আমি JeevanSetu AI সহায়ক। আমি সাধারণ স্বাস্থ্য তথ্য, হাসপাতাল এবং JeevanSetu ব্যবহারে সাহায্য করতে পারি।',
    thanks: 'আপনাকে স্বাগতম! নিজের যত্ন নিন।',
    emergencyHeadline:
      'তীব্র বুকে ব্যথা ও শ্বাসকষ্ট জরুরি অবস্থা হতে পারে। অনুগ্রহ করে এখনই ১১২ নম্বরে কল করুন বা দ্রুত জরুরি চিকিৎসা নিন।',
    hospitalAskLocation: 'অবশ্যই। আমি কি আপনার বর্তমান অবস্থান ব্যবহার করব, নাকি আপনি এলাকা লিখতে চান?',
    travelAskPermission: 'সড়ক দূরত্ব বের করতে আমি কি আপনার বর্তমান অবস্থান ব্যবহার করতে পারি?',
    disclaimer: 'শুধুমাত্র সাধারণ তথ্য — রোগ নির্ণয় বা প্রেসক্রিপশন নয়। জরুরি অবস্থায় এখনই ১১২ কল করুন।',
    medicalRefusal:
      'আমি ওষুধ লিখে দিতে, ডোজ বলতে বা রোগ নির্ণয় করতে পারি না — এর জন্য একজন যোগ্য ডাক্তার প্রয়োজন যিনি আপনাকে পরীক্ষা করবেন। আমি সঠিক হাসপাতাল বা বিভাগ খুঁজে পেতে সাহায্য করতে পারি, এবং জরুরি অবস্থায় এখনই ১১২ নম্বরে কল করুন।',
    liveDataRefusal:
      'এই হাসপাতালের বেড, আইসিইউ বা ডাক্তারের প্রাপ্যতার লাইভ তথ্য আমার কাছে নেই, তাই আমি অনুমান করব না। প্রকৃত প্রাপ্যতার জন্য সরাসরি হাসপাতাল ডেস্কে কল করুন — আমি ফোন নম্বর, ঠিকানা ও ড্রাইভিং রুট দেখাতে পারি।',
  },
  te: {
    greetingMorning: 'శుభోదయం! మీరు ఎలా ఉన్నారు?',
    greetingAfternoon: 'నమస్కారం! నేను ఎలా సహాయపడగలను?',
    greetingEvening: 'శుభ సాయంత్రం! మీరు ఎలా ఉన్నారు?',
    greetingNight: 'నమస్కారం! నేను ఎలా సహాయపడగలను?',
    casualWell: 'నేను బాగున్నాను, ధన్యవాదాలు! నేను ఎలా సహాయపడగలను?',
    identity: 'నేను JeevanSetu AI సహాయకుడిని. సాధారణ ఆరోగ్య సమాచారం, ఆసుపత్రులు మరియు JeevanSetu వినియోగంలో సహాయం చేయగలను.',
    medicalRefusal:
      'నేను మందులు సూచించలేను, మోతాదు చెప్పలేను లేదా వ్యాధిని నిర్ధారించలేను — దీనికి మిమ్మల్ని పరీక్షించగల అర్హత కలిగిన వైద్యుడు అవసరం. సరైన ఆసుపత్రి లేదా విభాగాన్ని కనుగొనడంలో నేను సహాయం చేయగలను; అత్యవసర స్థితిలో వెంటనే 112కు కాల్ చేయండి.',
    liveDataRefusal:
      'ఈ ఆసుపత్రిలో బెడ్లు, ఐసీయూ లేదా వైద్యుల లభ్యతపై ప్రత్యక్ష సమాచారం నా వద్ద లేదు, కాబట్టి నేను ఊహించను. నిజమైన లభ్యత కోసం ఆసుపత్రి డెస్క్కు నేరుగా కాల్ చేయండి — ఫోన్ నంబర్, చిరునామా మరియు డ్రైవింగ్ మార్గాన్ని చూపగలను.',
    thanks: 'మీకు స్వాగతం! జాగ్రత్తగా ఉండండి.',
    emergencyHeadline:
      'తీవ్రమైన ఛాతీ నొప్పి మరియు శ్వాస ఇబ్బంది అత్యవసర పరిస్థితి కావచ్చు. దయచేసి ఇప్పుడే 112 కి కాల్ చేయండి లేదా వెంటనే అత్యవసర చికిత్స పొందండి.',
    hospitalAskLocation: 'తప్పకుండా. నేను మీ ప్రస్తుత స్థానాన్ని ఉపయోగించాలా, లేదా మీరు ప్రాంతం నమోదు చేస్తారా?',
    travelAskPermission: 'రోడ్డు దూరం లెక్కించడానికి నేను మీ ప్రస్తుత స్థానాన్ని ఉపయోగించవచ్చా?',
    disclaimer: 'సాధారణ సమాచారం మాత్రమే — నిర్ధారణ లేదా ప్రిస్క్రిప్షన్ కాదు. అత్యవసరమైతే ఇప్పుడే 112 కి కాల్ చేయండి.',
  },
  mr: {
    greetingMorning: 'शुभ सकाळ! तुम्ही कसे आहात?',
    greetingAfternoon: 'नमस्कार! मी कशी मदत करू शकतो?',
    greetingEvening: 'शुभ संध्याकाळ! तुम्ही कसे आहात?',
    greetingNight: 'नमस्कार! मी कशी मदत करू शकतो?',
    casualWell: 'मी ठीक आहे, धन्यवाद! मी कशी मदत करू शकतो?',
    identity: 'मी JeevanSetu AI सहाय्यक आहे. सामान्य आरोग्य माहिती, रुग्णालये आणि JeevanSetu वापरात मदत करू शकतो.',
    thanks: 'तुमचे स्वागत आहे! काळजी घ्या.',
    emergencyHeadline:
      'तीव्र छातीत दुखणे आणि श्वास घेण्यास त्रास ही आणीबाणी असू शकते. कृपया आत्ताच 112 वर कॉल करा किंवा तातडीने आपत्कालीन उपचार घ्या.',
    hospitalAskLocation: 'नक्की. मी तुमचे सध्याचे स्थान वापरू का, की तुम्ही परिसर लिहाल?',
    travelAskPermission: 'रस्त्याचे अंतर काढण्यासाठी मी तुमचे सध्याचे स्थान वापरू शकतो का?',
    disclaimer: 'फक्त सामान्य माहिती — निदान किंवा औषधोपचार नाही. आणीबाणीत आत्ताच 112 वर कॉल करा.',
  },
  ta: {
    greetingMorning: 'காலை வணக்கம்! நீங்கள் எப்படி இருக்கிறீர்கள்?',
    greetingAfternoon: 'வணக்கம்! நான் எப்படி உதவலாம்?',
    greetingEvening: 'மாலை வணக்கம்! நீங்கள் எப்படி இருக்கிறீர்கள்?',
    greetingNight: 'வணக்கம்! நான் எப்படி உதவலாம்?',
    casualWell: 'நான் நன்றாக இருக்கிறேன், நன்றி! நான் எப்படி உதவலாம்?',
    identity: 'நான் JeevanSetu AI உதவியாளர். பொதுவான சுகாதார தகவல், மருத்துவமனைகள் மற்றும் JeevanSetu பயன்பாட்டில் உதவ முடியும்.',
    thanks: 'வரவேற்கிறேன்! உங்களை கவனித்துக் கொள்ளுங்கள்.',
    emergencyHeadline:
      'கடுமையான நெஞ்சு வலி மற்றும் மூச்சுத்திணறல் அவசரநிலையாக இருக்கலாம். உடனே 112 ஐ அழைக்கவும் அல்லது விரைவாக அவசர சிகிச்சை பெறவும்.',
    hospitalAskLocation: 'நிச்சயம். நான் உங்கள் தற்போதைய இருப்பிடத்தைப் பயன்படுத்தவா, அல்லது நீங்கள் பகுதியை உள்ளிடுவீர்களா?',
    travelAskPermission: 'சாலை தூரம் கணக்கிட உங்கள் தற்போதைய இருப்பிடத்தைப் பயன்படுத்தலாமா?',
    disclaimer: 'பொதுவான தகவல் மட்டுமே — நோயறிதல் அல்லது மருந்துச்சீட்டு அல்ல. அவசரத்திற்கு உடனே 112 அழைக்கவும்.',
  },
  gu: {
    greetingMorning: 'સુપ્રભાત! તમે કેમ છો?',
    greetingAfternoon: 'નમસ્તે! હું કેવી રીતે મદદ કરી શકું?',
    greetingEvening: 'શુભ સાંજ! તમે કેમ છો?',
    greetingNight: 'નમસ્તે! હું કેવી રીતે મદદ કરી શકું?',
    casualWell: 'હું મજામાં છું, આભાર! હું કેવી રીતે મદદ કરી શકું?',
    identity: 'હું JeevanSetu AI સહાયક છું. સામાન્ય આરોગ્ય માહિતી, હોસ્પિટલ અને JeevanSetu વપરાશમાં મદદ કરી શકું છું.',
    thanks: 'તમારું સ્વાગત છે! ધ્યાન રાખો.',
    emergencyHeadline:
      'તીવ્ર છાતીમાં દુખાવો અને શ્વાસ લેવામાં તકલીફ કટોકટી હોઈ શકે છે. કૃપા કરીને હમણાં જ 112 પર કૉલ કરો અથવા તાત્કાલિક કટોકટી સારવાર લો.',
    hospitalAskLocation: 'ચોક્કસ. હું તમારું વર્તમાન સ્થાન વાપરું, કે તમે વિસ્તાર લખશો?',
    travelAskPermission: 'રસ્તાનું અંતર ગણવા હું તમારું વર્તમાન સ્થાન વાપરી શકું?',
    disclaimer: 'ફક્ત સામાન્ય માહિતી — નિદાન કે પ્રિસ્ક્રિપ્શન નહીં. કટોકટીમાં હમણાં જ 112 પર કૉલ કરો.',
  },
  ur: {
    greetingMorning: 'صبح بخیر! آپ کیسے ہیں؟',
    greetingAfternoon: 'السلام علیکم! میں کیسے مدد کر سکتا ہوں؟',
    greetingEvening: 'شب بخیر! آپ کیسے ہیں؟',
    greetingNight: 'السلام علیکم! میں کیسے مدد کر سکتا ہوں؟',
    casualWell: 'میں ٹھیک ہوں، شکریہ! میں کیسے مدد کر سکتا ہوں؟',
    identity: 'میں JeevanSetu AI معاون ہوں۔ میں عمومی صحت کی معلومات، اسپتال اور JeevanSetu کے استعمال میں مدد کر سکتا ہوں۔',
    thanks: 'آپ کا شکریہ! اپنا خیال رکھیں۔',
    emergencyHeadline:
      'شدید سینے میں درد اور سانس لینے میں دشواری ایمرجنسی ہو سکتی ہے۔ براہ کرم فوراً 112 پر کال کریں یا فوری طبی امداد حاصل کریں۔',
    hospitalAskLocation: 'بالکل۔ کیا میں آپ کا موجودہ مقام استعمال کروں، یا آپ علاقہ لکھیں گے؟',
    travelAskPermission: 'سڑک کا فاصلہ معلوم کرنے کے لیے کیا میں آپ کا موجودہ مقام استعمال کر سکتا ہوں؟',
    disclaimer: 'صرف عمومی معلومات — تشخیص یا نسخہ نہیں۔ ایمرجنسی میں فوراً 112 پر کال کریں۔',
  },
  kn: {
    greetingMorning: 'ಶುಭೋದಯ! ನೀವು ಹೇಗಿದ್ದೀರಿ?',
    greetingAfternoon: 'ನಮಸ್ಕಾರ! ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
    greetingEvening: 'ಶುಭ ಸಂಜೆ! ನೀವು ಹೇಗಿದ್ದೀರಿ?',
    greetingNight: 'ನಮಸ್ಕಾರ! ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
    casualWell: 'ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ, ಧನ್ಯವಾದ! ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
    identity: 'ನಾನು JeevanSetu AI ಸಹಾಯಕ. ಸಾಮಾನ್ಯ ಆರೋಗ್ಯ ಮಾಹಿತಿ, ಆಸ್ಪತ್ರೆಗಳು ಮತ್ತು JeevanSetu ಬಳಕೆಯಲ್ಲಿ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.',
    thanks: 'ಸ್ವಾಗತ! ನಿಮ್ಮ ಆರೈಕೆ ಮಾಡಿಕೊಳ್ಳಿ.',
    emergencyHeadline:
      'ತೀವ್ರ ಎದೆ ನೋವು ಮತ್ತು ಉಸಿರಾಟದ ತೊಂದರೆ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಾಗಿರಬಹುದು. ದಯವಿಟ್ಟು ಈಗಲೇ 112 ಗೆ ಕರೆ ಮಾಡಿ ಅಥವಾ ತಕ್ಷಣ ತುರ್ತು ಚಿಕಿತ್ಸೆ ಪಡೆಯಿರಿ.',
    hospitalAskLocation: 'ಖಂಡಿತ. ನಾನು ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಸ್ಥಳವನ್ನು ಬಳಸಲೇ, ಅಥವಾ ನೀವು ಪ್ರದೇಶ ಬರೆಯುತ್ತೀರಾ?',
    travelAskPermission: 'ರಸ್ತೆ ದೂರ ಲೆಕ್ಕಿಸಲು ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಸ್ಥಳವನ್ನು ಬಳಸಬಹುದೇ?',
    disclaimer: 'ಸಾಮಾನ್ಯ ಮಾಹಿತಿ ಮಾತ್ರ — ನಿರ್ಣಯ ಅಥವಾ ಚೀಟಿ ಅಲ್ಲ. ತುರ್ತಿನಲ್ಲಿ ಈಗಲೇ 112 ಕರೆ ಮಾಡಿ.',
  },
  or: {
    greetingMorning: 'ଶୁଭ ସକାଳ! ଆପଣ କେମିତି ଅଛନ୍ତି?',
    greetingAfternoon: 'ନମସ୍କାର! ମୁଁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?',
    greetingEvening: 'ଶୁଭ ସନ୍ଧ୍ୟା! ଆପଣ କେମିତି ଅଛନ୍ତି?',
    greetingNight: 'ନମସ୍କାର! ମୁଁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?',
    casualWell: 'ମୁଁ ଭଲ ଅଛି, ଧନ୍ୟବାଦ! ମୁଁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?',
    identity: 'ମୁଁ JeevanSetu AI ସହାୟକ। ସାଧାରଣ ସ୍ୱାସ୍ଥ୍ୟ ସୂଚନା, ଡାକ୍ତରଖାନା ଏବଂ JeevanSetu ବ୍ୟବହାରରେ ସାହାଯ୍ୟ କରିପାରିବି।',
    thanks: 'ସ୍ୱାଗତ! ନିଜର ଯତ୍ନ ନିଅନ୍ତୁ।',
    emergencyHeadline:
      'ତୀବ୍ର ଛାତି ଯନ୍ତ୍ରଣା ଏବଂ ନିଶ୍ୱାସ ନେବାରେ ଅସୁବିଧା ଜରୁରୀ ଅବସ୍ଥା ହୋଇପାରେ। ଦୟାକରି ଏବେ 112 କୁ କଲ କରନ୍ତୁ କିମ୍ବା ତୁରନ୍ତ ଜରୁରୀ ଚିକିତ୍ସା ନିଅନ୍ତୁ।',
    hospitalAskLocation: 'ନିଶ୍ଚୟ। ମୁଁ ଆପଣଙ୍କ ବର୍ତ୍ତମାନ ସ୍ଥାନ ବ୍ୟବହାର କରିବି, କିମ୍ବା ଆପଣ ଅଞ୍ଚଳ ଲେଖିବେ?',
    travelAskPermission: 'ରାସ୍ତା ଦୂରତା ଗଣନା ପାଇଁ ମୁଁ ଆପଣଙ୍କ ବର୍ତ୍ତମାନ ସ୍ଥାନ ବ୍ୟବହାର କରିପାରିବି କି?',
    disclaimer: 'କେବଳ ସାଧାରଣ ସୂଚନା — ରୋଗ ନିର୍ଣ୍ଣୟ କିମ୍ବା ପ୍ରେସକ୍ରିପସନ ନୁହେଁ। ଜରୁରୀରେ ଏବେ 112 କଲ କରନ୍ତୁ।',
  },
  ml: {
    greetingMorning: 'സുപ്രഭാതം! നിങ്ങൾക്ക് സുഖമാണോ?',
    greetingAfternoon: 'നമസ്കാരം! ഞാൻ എങ്ങനെ സഹായിക്കാം?',
    greetingEvening: 'ശുഭ സായാഹ്നം! നിങ്ങൾക്ക് സുഖമാണോ?',
    greetingNight: 'നമസ്കാരം! ഞാൻ എങ്ങനെ സഹായിക്കാം?',
    casualWell: 'ഞാൻ സുഖമായിരിക്കുന്നു, നന്ദി! ഞാൻ എങ്ങനെ സഹായിക്കാം?',
    identity: 'ഞാൻ JeevanSetu AI അസിസ്റ്റന്റ് ആണ്. പൊതുവായ ആരോഗ്യ വിവരങ്ങൾ, ആശുപത്രികൾ, JeevanSetu ഉപയോഗം എന്നിവയിൽ സഹായിക്കാം.',
    thanks: 'നന്ദി! സൂക്ഷിക്കുക.',
    emergencyHeadline:
      'തീവ്രമായ നെഞ്ചുവേദനയും ശ്വാസതടസ്സവും അത്യാഹിതമായിരിക്കാം. ദയവായി ഉടൻ 112-ൽ വിളിക്കുക അല്ലെങ്കിൽ ഉടൻ അടിയന്തര ചികിത്സ തേടുക.',
    hospitalAskLocation: 'തീർച്ചയായും. ഞാൻ നിങ്ങളുടെ നിലവിലെ സ്ഥാനം ഉപയോഗിക്കണോ, അതോ നിങ്ങൾ പ്രദേശം നൽകുമോ?',
    travelAskPermission: 'റോഡ് ദൂരം കണക്കാക്കാൻ നിങ്ങളുടെ നിലവിലെ സ്ഥാനം ഉപയോഗിക്കാമോ?',
    disclaimer: 'പൊതുവായ വിവരങ്ങൾ മാത്രം — രോഗനിർണയമോ കുറിപ്പടിയോ അല്ല. അത്യാഹിതത്തിൽ ഉടൻ 112-ൽ വിളിക്കുക.',
  },
};

export const ASSISTANT_COPY: Record<Lang, AssistantCopy> = {
  en: EN,
  hi: HI,
  ...(Object.fromEntries(
    Object.entries(OVERRIDES).map(([k, v]) => [k, { ...EN, ...v }]),
  ) as Record<Exclude<Lang, 'en' | 'hi'>, AssistantCopy>),
};

export function assistantCopy(lang: Lang): AssistantCopy {
  return ASSISTANT_COPY[lang] ?? EN;
}

/** Greeting chosen by local time of day, so it never feels canned. */
export function timeOfDayGreeting(copy: AssistantCopy, istHour: number): string {
  if (istHour >= 5 && istHour < 12) return copy.greetingMorning;
  if (istHour >= 12 && istHour < 17) return copy.greetingAfternoon;
  if (istHour >= 17 && istHour < 22) return copy.greetingEvening;
  return copy.greetingNight;
}
