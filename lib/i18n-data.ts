import type { Lang } from './i18n';

export const SPECIALITY_HI: Record<string, string> = {
  'Burn & Plastic Surgery': 'बर्न एवं प्लास्टिक सर्जरी',
  Cardiology: 'हृदय रोग (कार्डियोलॉजी)',
  Dental: 'दंत चिकित्सा',
  Dermatology: 'त्वचा रोग',
  Endocrinology: 'हार्मोन एवं मधुमेह (एंडोक्राइनोलॉजी)',
  ENT: 'कान, नाक, गला (ENT)',
  Gastroenterology: 'पेट एवं पाचन रोग (गैस्ट्रोएंटरोलॉजी)',
  'General Medicine': 'सामान्य चिकित्सा',
  'General Surgery': 'सामान्य सर्जरी',
  'Gynaecology & Obstetrics': 'स्त्री एवं प्रसूति रोग',
  Nephrology: 'गुर्दा रोग (नेफ्रोलॉजी)',
  Neurology: 'मस्तिष्क एवं तंत्रिका रोग (न्यूरोलॉजी)',
  Oncology: 'कैंसर रोग (ऑन्कोलॉजी)',
  Ophthalmology: 'नेत्र रोग',
  Orthopaedics: 'हड्डी एवं जोड़ रोग (ऑर्थोपेडिक्स)',
  Paediatrics: 'बाल रोग',
  Psychiatry: 'मानसिक स्वास्थ्य (मनोरोग)',
  Pulmonology: 'फेफड़े एवं श्वास रोग',
  Urology: 'मूत्र रोग (यूरोलॉजी)',
};

export const FACILITY_HI: Record<string, string> = {
  Ambulance: 'एम्बुलेंस',
  'Blood Bank': 'ब्लड बैंक',
  'Burn Unit': 'बर्न यूनिट',
  'Cashless / Insurance Desk': 'कैशलेस / बीमा डेस्क',
  'CT Scan': 'CT स्कैन',
  'Diagnostic Lab': 'जांच प्रयोगशाला (लैब)',
  Dialysis: 'डायलिसिस',
  'Emergency 24×7': '24×7 आपातकालीन सेवा',
  ICU: 'ICU',
  'Maternity & Delivery': 'मातृत्व एवं प्रसव सेवा',
  MRI: 'MRI',
  'Operation Theatre': 'ऑपरेशन थिएटर',
  Ultrasound: 'अल्ट्रासाउंड',
  'Wheelchair Access': 'व्हीलचेयर सुविधा',
  'X-Ray': 'एक्स-रे',
};

export const CITY_HI: Record<string, string> = {
  'New Delhi': 'नई दिल्ली',
  Delhi: 'दिल्ली',
  Gurugram: 'गुरुग्राम',
  Noida: 'नोएडा',
  'Greater Noida': 'ग्रेटर नोएडा',
  Ghaziabad: 'गाज़ियाबाद',
  Faridabad: 'फरीदाबाद',
  Mumbai: 'मुंबई',
  Pune: 'पुणे',
  Bengaluru: 'बेंगलुरु',
  Chennai: 'चेन्नई',
  Kolkata: 'कोलकाता',
  Ahmedabad: 'अहमदाबाद',
  Jaipur: 'जयपुर',
  Lucknow: 'लखनऊ',
  Patna: 'पटना',
  Bhopal: 'भोपाल',
  Hyderabad: 'हैदराबाद',
  Chandigarh: 'चंडीगढ़',
  Nagpur: 'नागपुर',
  Varanasi: 'वाराणसी',
  Dehradun: 'देहरादून',
};

export const STATE_HI: Record<string, string> = {
  Delhi: 'दिल्ली',
  Haryana: 'हरियाणा',
  'Uttar Pradesh': 'उत्तर प्रदेश',
  Maharashtra: 'महाराष्ट्र',
  Karnataka: 'कर्नाटक',
  'Tamil Nadu': 'तमिलनाडु',
  'West Bengal': 'पश्चिम बंगाल',
  Gujarat: 'गुजरात',
  Rajasthan: 'राजस्थान',
  Bihar: 'बिहार',
  'Madhya Pradesh': 'मध्य प्रदेश',
  Telangana: 'तेलंगाना',
  Chandigarh: 'चंडीगढ़',
  Uttarakhand: 'उत्तराखंड',
};

export const TREATMENT_CATEGORY_HI: Record<string, string> = {
  'Outpatient (OPD)': 'बाह्य रोगी विभाग (OPD)',
  'Diagnostic test': 'जांच (डायग्नोस्टिक टेस्ट)',
  'Inpatient / OPD': 'भर्ती / OPD',
  Maternity: 'मातृत्व एवं प्रसव',
  'Surgery / Procedure': 'सर्जरी / प्रक्रिया',
  'Chronic care': 'दीर्घकालिक देखभाल',
  Oncology: 'कैंसर उपचार (ऑन्कोलॉजी)',
};

export const TREATMENT_TEST_HI: Record<string, string> = {
  'Blood test (CBC)': 'खून की जांच (CBC)',
  'Urine routine': 'पेशाब की सामान्य जांच',
  'Complete Blood Count': 'पूर्ण रक्त गणना (CBC)',
  'Chest X-Ray (PA view)': 'चेस्ट एक्स-रे (PA व्यू)',
  'MRI (single part, with/without contrast)': 'MRI (एक अंग, कॉन्ट्रास्ट सहित/रहित)',
  'Ultrasound abdomen & pelvis': 'पेट और श्रोणि का अल्ट्रासाउंड',
  ECG: 'ECG',
  'Antenatal blood tests (panel)': 'प्रसव-पूर्व रक्त जांच (पैनल)',
  'Ultrasound (dating/anomaly)': 'अल्ट्रासाउंड (गर्भावस्था जांच)',
  'Antenatal blood tests + ultrasound': 'प्रसव-पूर्व रक्त जांच + अल्ट्रासाउंड',
  'Pre-anaesthesia check-up': 'एनेस्थीसिया से पहले की जांच',
  'Pre-op eye tests (biometry)': 'ऑपरेशन से पहले आंखों की जांच (बायोमेट्री)',
  'CBC + ultrasound abdomen': 'CBC + पेट का अल्ट्रासाउंड',
  'ECG + troponin': 'ECG + ट्रोपोनिन जांच',
  'Angiography (diagnostic)': 'एंजियोग्राफी (जांच)',
  'Pre-dialysis blood tests': 'डायलिसिस से पहले खून की जांच',
  'Pre-op blood panel + ECG': 'ऑपरेशन से पहले रक्त जांच + ECG',
  'X-ray (2 views)': 'एक्स-रे (2 व्यू)',
  'WIDAL / blood culture': 'विडाल / ब्लड कल्चर',
  CBC: 'CBC',
  'NS1 antigen + platelet counts (serial)': 'NS1 एंटीजन + प्लेटलेट काउंट (क्रमिक जांच)',
  'CBC (daily monitoring)': 'CBC (दैनिक निगरानी)',
  'Pre-op panel + X-ray': 'ऑपरेशन से पहले जांच पैनल + एक्स-रे',
  'CBC before each cycle': 'प्रत्येक चक्र से पहले CBC',
  'PET/CT staging work-up': 'PET/CT स्टेजिंग जांच',
};

export const TREATMENT_NOTE_HI: Record<string, string> = {
  'general-consultation': 'अधिकांश सरकारी OPD में केवल नाममात्र पंजीकरण शुल्क (₹10–50) लगता है।',
  'cbc-test': 'परामर्श कॉलम में डॉक्टर से मिलने पर लगने वाली फ़ीस दिखाई गई है; कई लैब सीधे रिपोर्ट देते हैं।',
  mri: 'कुछ केंद्रों में कॉन्ट्रास्ट डाई का थोड़ा अतिरिक्त शुल्क लगता है।',
  ecg: 'अस्पताल से पूछें कि किन सेवाओं का शुल्क शामिल है और क्या आपकी स्थिति में कोई योजना लागू होती है।',
  'normal-delivery': 'अस्पताल से पूछें कि किन सेवाओं का शुल्क शामिल है और क्या आपकी स्थिति में कोई योजना लागू होती है।',
  caesarean: 'अस्पताल से पूछें कि किन सेवाओं का शुल्क शामिल है और क्या आपकी स्थिति में कोई योजना लागू होती है।',
  cataract: 'अस्पताल से पूछें कि किन सेवाओं का शुल्क शामिल है और क्या आपकी स्थिति में कोई योजना लागू होती है।',
  appendectomy: 'सरकारी अस्पतालों में आपातकालीन अपेंडिक्स सर्जरी पर सब्सिडी मिलती है; जटिल (फटे हुए) मामलों में खर्च बढ़ सकता है।',
  angioplasty: 'अस्पताल से पूछें कि किन सेवाओं का शुल्क शामिल है और क्या आपकी स्थिति में कोई योजना लागू होती है।',
  'dialysis-session': 'अस्पताल से पूछें कि किन सेवाओं का शुल्क शामिल है और क्या आपकी स्थिति में कोई योजना लागू होती है।',
  'fracture-minor': 'प्लास्टर/स्प्लिंटिंग सस्ता होता है; हड्डी खिसकने पर सर्जरी में अधिक खर्च आता है।',
  typhoid: 'सामान्य टाइफाइड का इलाज OPD में होता है; गंभीर मामलों में भर्ती होना पड़ सकता है। कमरे का शुल्क केवल भर्ती होने पर लागू होता है।',
  'dengue-admit': 'केवल गंभीर या चेतावनी लक्षणों वाले डेंगू में IV फ़्लूइड और प्लेटलेट निगरानी के लिए भर्ती की ज़रूरत होती है।',
  'knee-replacement': 'सूचीबद्ध अस्पतालों में PM-JAY और राज्य योजनाएं पैकेज सीमा तक इसे कवर कर सकती हैं। इम्प्लांट की कीमत मुख्य खर्च होती है।',
  chemotherapy: 'कीमोथेरेपी का खर्च पूरी तरह दवाओं के प्रोटोकॉल (जैसे जेनेरिक बनाम टारगेटेड थेरेपी) पर निर्भर करता है। कोई एक सटीक सीमा नहीं हो सकती — इसलिए दवाओं की व्यापक संभावित सीमा दिखाई गई है और प्रक्रिया शुल्क जानबूझकर खाली रखा गया है। अपने ऑन्कोलॉजिस्ट से लिखित प्रोटोकॉल खर्च ज़रूर पूछें।',
};

export const TREATMENT_SOURCE_HI =
  'सार्वजनिक CGHS / राज्य योजना / PM-JAY पैकेज संदर्भों और प्रकाशित अस्पताल शुल्क सूचियों (2023–2025) से संकलित अनुमानित सीमा। वास्तविक खर्च भिन्न हो सकता है।';

export const HELPLINE_HI: Record<string, { label: string; detail: string }> = {
  '112': {
    label: 'राष्ट्रीय आपातकालीन नंबर',
    detail: 'पुलिस, अग्निशमन, एम्बुलेंस — सभी आपात स्थितियों के लिए एक नंबर। मुफ़्त, 24×7, किसी भी फ़ोन से चलता है।',
  },
  '108': {
    label: 'एम्बुलेंस (अधिकांश राज्यों में)',
    detail: 'भारत के अधिकांश राज्यों में मुफ़्त सरकारी एम्बुलेंस सेवा।',
  },
  '102': {
    label: 'गर्भवती महिलाओं और बच्चों के लिए एम्बुलेंस',
    detail: 'कई राज्यों में गर्भवती महिलाओं और बीमार शिशुओं के लिए मुफ़्त आपातकालीन वाहन सेवा।',
  },
  '104': {
    label: 'स्वास्थ्य जानकारी हेल्पलाइन',
    detail: 'कई राज्यों में चिकित्सीय सलाह और डायरेक्टरी सहायता।',
  },
  '14567': {
    label: 'वरिष्ठ नागरिक हेल्पलाइन (एल्डरलाइन)',
    detail: 'आपात स्थिति और संकट में वरिष्ठ नागरिकों के लिए सहायता।',
  },
};

export interface HospitalHiMeta {
  tagline?: string;
  emergencyNote?: string;
  opdTimings?: string;
  ownershipNote?: string;
  dataNote?: string;
}

export const HOSPITAL_HI: Record<string, HospitalHiMeta> = {
  'aiims-new-delhi': {
    tagline: 'प्रमुख सार्वजनिक सुपर-स्पेशियलिटी एवं अनुसंधान संस्थान',
    emergencyNote: '24×7 ट्रॉमा सेंटर और आपातकालीन सेवाएं। क्षेत्र का सबसे अधिक भीड़ वाला सरकारी संस्थान।',
    opdTimings: 'कार्यदिवसों में OPD पंजीकरण लगभग सुबह 7:00–9:00 बजे; लंबी कतार की उम्मीद रखें। ट्रॉमा/आपातकाल 24×7 खुला है।',
    dataNote: 'सरकारी दरें; अत्यधिक सब्सिडी वाला इलाज। OPD स्लॉट बहुत जल्दी भरते हैं — सुबह 8 बजे से पहले पहुंचें।',
  },
  'safdarjung-hospital': {
    tagline: 'भारत के सबसे बड़े सरकारी अस्पतालों में से एक',
    emergencyNote: '24×7 आपातकालीन सेवा और दिल्ली की सबसे बड़ी बर्न यूनिट्स में से एक।',
    opdTimings: 'सामान्य OPD लगभग सुबह 8:30–दोपहर 12:30 बजे; शनिवार को लगभग सुबह 10 बजे तक (अनुमानित)।',
    dataNote: 'सरकारी दरें; बहुत कम खर्च। मरीजों की भारी भीड़ — प्रतीक्षा समय के लिए तैयार रहें।',
  },
  'rml-hospital': {
    tagline: 'केंद्र सरकार का तृतीयक देखभाल अस्पताल',
    emergencyNote: '24×7 आपातकालीन सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:30–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'केंद्र सरकार की दरें; सब्सिडी पर जांच सुविधाएं।',
  },
  'lok-nayak-hospital': {
    tagline: 'मध्य दिल्ली का प्रमुख सरकारी अस्पताल',
    emergencyNote: '24×7 आपातकालीन एवं बर्न देखभाल।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:00–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'दिल्ली सरकार की दरें; बहुत कम खर्च।',
  },
  'gtb-hospital': {
    tagline: 'पूर्वी दिल्ली का प्रमुख शिक्षण अस्पताल',
    emergencyNote: '24×7 कैज़ुअल्टी और आपातकालीन सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:30–दोपहर 12:00 बजे (अनुमानित)।',
    dataNote: 'दिल्ली सरकार की दरें। UCMS शिक्षण अस्पताल से संबद्ध।',
  },
  'ddu-hospital': {
    tagline: 'पश्चिमी दिल्ली का बड़ा सरकारी अस्पताल',
    emergencyNote: '24×7 आपातकालीन सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:30–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'दिल्ली सरकार की दरें। फ़ोन नंबर विश्वसनीय रूप से सूचीबद्ध नहीं है — कृपया डायरेक्टरी सहायता (104) पर कॉल करें।',
  },
  'bsa-hospital': {
    tagline: 'उत्तर-पश्चिम दिल्ली का सरकारी अस्पताल',
    emergencyNote: '24×7 कैज़ुअल्टी सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:30–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'दिल्ली सरकार की दरें।',
  },
  'bjrm-hospital': {
    tagline: 'उत्तरी दिल्ली का सरकारी अस्पताल',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 9:00–दोपहर 1:00 बजे (अनुमानित)।',
    dataNote: 'दिल्ली सरकार की दरें।',
  },
  'barahindurao-hospital': {
    tagline: 'मध्य दिल्ली का सरकारी अस्पताल',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:30–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'दिल्ली सरकार की दरें।',
  },
  'lbs-khichripur': {
    tagline: 'पूर्वी दिल्ली का सरकारी अस्पताल',
    emergencyNote: '24×7 आपातकालीन सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:30–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'दिल्ली सरकार की दरें।',
  },
  'sir-ganga-ram-hospital': {
    tagline: 'पश्चिम-मध्य दिल्ली का प्रतिष्ठित निजी सुपर-स्पेशियलिटी अस्पताल',
    emergencyNote: '24×7 आपातकालीन सेवाएं।',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 9:00–शाम 5:00 बजे; शनिवार सुबह।',
    dataNote: 'निजी शुल्क; बीमा और कैशलेस डेस्क उपलब्ध।',
  },
  'max-saket': {
    tagline: 'दक्षिण दिल्ली का बड़ा निजी सुपर-स्पेशियलिटी अस्पताल',
    emergencyNote: '24×7 आपातकालीन सेवाएं।',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 8:00–शाम 6:00 बजे।',
    dataNote: 'निजी शुल्क; कैशलेस बीमा उपलब्ध।',
  },
  'blk-max-pusa': {
    tagline: 'मध्य दिल्ली का निजी सुपर-स्पेशियलिटी अस्पताल',
    emergencyNote: '24×7 आपातकालीन सेवाएं।',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 9:00–शाम 5:00 बजे।',
    dataNote: 'निजी शुल्क; कैशलेस बीमा उपलब्ध।',
  },
  'apollo-indraprastha': {
    tagline: 'दक्षिण-पूर्व दिल्ली का प्रमुख निजी अस्पताल',
    emergencyNote: '24×7 आपातकालीन, ट्रॉमा और एम्बुलेंस नेटवर्क।',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 8:00–रात 8:00 बजे।',
    dataNote: 'निजी शुल्क; कैशलेस बीमा उपलब्ध।',
  },
  'fortis-escorts-okhla': {
    tagline: 'दक्षिण दिल्ली का हृदय रोग केंद्रित निजी संस्थान',
    emergencyNote: '24×7 हृदय आपातकालीन एवं एम्बुलेंस सेवाएं।',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 9:00–शाम 5:00 बजे।',
    dataNote: 'हृदय रोग सुपर-स्पेशियलिटी। अन्य रोगों के लिए मल्टी-स्पेशियलिटी विकल्प देखें।',
  },
  'fortis-vasant-kunj': {
    tagline: 'दक्षिण-पश्चिम दिल्ली का निजी सुपर-स्पेशियलिटी अस्पताल',
    emergencyNote: '24×7 आपातकालीन सेवाएं।',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 8:00–शाम 6:00 बजे।',
    dataNote: 'निजी शुल्क; कैशलेस बीमा उपलब्ध।',
  },
  'medanta-medicity': {
    tagline: 'उत्तर भारत के सबसे बड़े निजी सुपर-स्पेशियलिटी परिसरों में से एक',
    emergencyNote: '24×7 आपातकालीन और ट्रॉमा देखभाल।',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 8:00–रात 8:00 बजे।',
    dataNote: 'निजी शुल्क; ट्रांसप्लांट और कैंसर उपचार कार्यक्रम उपलब्ध।',
  },
  'fmri-gurugram': {
    tagline: 'अनुसंधान-उन्मुख निजी सुपर-स्पेशियलिटी अस्पताल',
    emergencyNote: '24×7 आपातकालीन सेवाएं।',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 8:30–शाम 6:00 बजे।',
    dataNote: 'निजी शुल्क; कैंसर और हृदय रोग पर विशेष ध्यान।',
  },
  'kailash-noida': {
    tagline: 'सेक्टर 27, नोएडा का निजी मल्टी-स्पेशियलिटी अस्पताल',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 9:00–शाम 6:00 बजे।',
    dataNote: 'निजी शुल्क; बड़े मेट्रो अस्पताल श्रृंखलाओं की तुलना में सामान्यतः कम।',
  },
  'sharda-greater-noida': {
    tagline: 'ग्रेटर नोएडा का बड़ा शिक्षण अस्पताल',
    emergencyNote: '24×7 आपातकालीन एवं ट्रॉमा सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:00–दोपहर 1:00 बजे (अनुमानित)।',
    dataNote: 'निजी शिक्षण अस्पताल; मिश्रित शुल्क स्लैब, सामान्यतः किफ़ायती।',
  },
  'yashoda-ghaziabad': {
    tagline: 'राज नगर, गाज़ियाबाद का निजी सुपर-स्पेशियलिटी अस्पताल',
    opdTimings: 'अपॉइंटमेंट से OPD, आमतौर पर कार्यदिवसों में सुबह 9:00–शाम 7:00 बजे।',
    dataNote: 'निजी शुल्क; मध्यम श्रेणी की दरें।',
  },
  'kem-mumbai': {
    tagline: 'परेल, मुंबई का प्रमुख सरकारी अस्पताल',
    emergencyNote: '24×7 कैज़ुअल्टी सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:00–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'नगर निगम / सरकारी दरें।',
  },
  'tata-memorial-mumbai': {
    tagline: 'पब्लिक-ट्रस्ट कैंसर केंद्र; सब्सिडी युक्त कैंसर देखभाल',
    emergencyNote: 'यह सामान्य आपातकालीन अस्पताल नहीं है — विशेष कैंसर उपचार केंद्र है।',
    opdTimings: 'पंजीकरण/अपॉइंटमेंट द्वारा OPD; पंजीकरण बहुत सुबह शुरू होता है।',
    ownershipNote: 'DAE के अंतर्गत स्वायत्त पब्लिक-ट्रस्ट संस्थान; भारी सब्सिडी वाला कैंसर उपचार।',
    dataNote: 'सब्सिडी युक्त दरें; सामान्य बीमारियों का अस्पताल नहीं है।',
  },
  'sassoon-pune': {
    tagline: 'पुणे का प्रमुख सरकारी अस्पताल',
    emergencyNote: '24×7 कैज़ुअल्टी सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:00–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'सरकारी दरें।',
  },
  'sms-jaipur': {
    tagline: 'जयपुर का शीर्ष सरकारी अस्पताल',
    emergencyNote: '24×7 कैज़ुअल्टी सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 9:00–दोपहर 1:00 बजे (अनुमानित)।',
    dataNote: 'सरकारी दरें।',
  },
  'kgmu-lucknow': {
    tagline: 'लखनऊ का प्रमुख सरकारी चिकित्सा विश्वविद्यालय',
    emergencyNote: '24×7 कैज़ुअल्टी सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:00–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'सरकारी दरें।',
  },
  'sgpgi-lucknow': {
    tagline: 'स्वायत्त सुपर-स्पेशियलिटी सरकारी संस्थान',
    opdTimings: 'अपॉइंटमेंट/पंजीकरण द्वारा OPD; कार्यदिवसों की सुबह (अनुमानित)।',
    dataNote: 'स्वायत्त सरकारी दरें; किडनी ट्रांसप्लांट के लिए प्रसिद्ध।',
  },
  'sskm-kolkata': {
    tagline: 'एजेसी बोस रोड, कोलकाता का प्रमुख सरकारी अस्पताल',
    emergencyNote: '24×7 आपातकालीन सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:30–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'सरकारी दरें।',
  },
  'victoria-bengaluru': {
    tagline: 'फ़ोर्ट क्षेत्र, बेंगलुरु का प्रमुख सरकारी अस्पताल',
    emergencyNote: '24×7 कैज़ुअल्टी सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:30–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'सरकारी दरें।',
  },
  'ggh-chennai': {
    tagline: 'भारत के सबसे पुराने और बड़े सरकारी अस्पतालों में से एक',
    emergencyNote: '24×7 कैज़ुअल्टी सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:00–दोपहर 12:00 बजे (अनुमानित)।',
    dataNote: 'सरकारी दरें; मद्रास मेडिकल कॉलेज से संबद्ध।',
  },
  'civil-ahmedabad': {
    tagline: 'असारवा, अहमदाबाद का प्रमुख सरकारी अस्पताल',
    emergencyNote: '24×7 कैज़ुअल्टी सेवाएं।',
    opdTimings: 'कार्यदिवसों में OPD लगभग सुबह 8:30–दोपहर 12:30 बजे (अनुमानित)।',
    dataNote: 'सरकारी दरें।',
  },
};

export function tSpeciality(s: string, lang: Lang): string {
  return lang === 'hi' ? (SPECIALITY_HI[s] ?? s) : s;
}

export function tFacility(f: string, lang: Lang): string {
  return lang === 'hi' ? (FACILITY_HI[f] ?? f) : f;
}

export function tCity(c: string, lang: Lang): string {
  return lang === 'hi' ? (CITY_HI[c] ?? c) : c;
}

export function tState(s: string, lang: Lang): string {
  return lang === 'hi' ? (STATE_HI[s] ?? s) : s;
}

export function tPresetLabel(label: string, lang: Lang): string {
  if (lang !== 'hi') return label;
  const parts = label.split(',').map((p) => p.trim());
  if (parts.length === 2) {
    return `${tCity(parts[0], 'hi')}, ${tState(parts[1], 'hi')}`;
  }
  return tCity(label, 'hi');
}

export function tTreatmentCategory(cat: string, lang: Lang): string {
  return lang === 'hi' ? (TREATMENT_CATEGORY_HI[cat] ?? cat) : cat;
}

export function tTreatmentTest(name: string, lang: Lang): string {
  return lang === 'hi' ? (TREATMENT_TEST_HI[name] ?? name) : name;
}

export function tTreatmentNote(id: string, fallback: string | undefined, lang: Lang): string | undefined {
  if (!fallback) return undefined;
  return lang === 'hi' ? (TREATMENT_NOTE_HI[id] ?? fallback) : fallback;
}

export function tHospitalMeta(
  id: string,
  field: keyof HospitalHiMeta,
  fallback: string | undefined | null,
  lang: Lang,
): string | undefined {
  if (!fallback) return undefined;
  if (lang === 'hi') {
    return HOSPITAL_HI[id]?.[field] ?? fallback;
  }
  return fallback;
}
