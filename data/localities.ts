/**
 * Offline-capable Indian Locality, Landmark, Pincode & City Gazetteer.
 *
 * Ensures fast, deterministic, high-accuracy geocoding across India even when
 * external APIs (Google Geocoding / OpenStreetMap Nominatim) are rate-limited,
 * offline, or blocked in restricted networks.
 *
 * Coordinates are verified public centroids for localities, hospital corridors,
 * transit hubs, and cities across India.
 */
export interface IndianLocality {
  id: string;
  label: string;
  city: string;
  state: string;
  pincode?: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const INDIAN_LOCALITIES: IndianLocality[] = [
  // ─── DELHI NCR LOCALITIES & LANDMARKS ───
  {
    id: 'pusa-road-delhi',
    label: 'Pusa Road, Karol Bagh, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110005',
    lat: 28.6426,
    lng: 77.1842,
    aliases: ['pusa road', 'karol bagh', 'rajendra place', 'old rajinder nagar', 'पूसा रोड', 'करोल बाग', 'பூசா சாலை', 'পুস রোড', 'پوسہ روڈ'],
  },
  {
    id: 'ansari-nagar-delhi',
    label: 'Ansari Nagar (AIIMS), New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110029',
    lat: 28.5672,
    lng: 77.2100,
    aliases: ['ansari nagar', 'aiims metro', 'safdarjung enclave', 'green park', 'अंसारी नगर', 'सफदरजंग'],
  },
  {
    id: 'connaught-place-delhi',
    label: 'Connaught Place (Central), New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    lat: 28.6315,
    lng: 77.2167,
    aliases: ['connaught place', 'cp', 'rajiv chowk', 'new delhi', 'baba kharak singh marg', 'कनॉट प्लेस', 'नई दिल्ली', 'புது தில்லி', 'নতুন দিল্লি', 'نئی دہلی'],
  },
  {
    id: 'saket-delhi',
    label: 'Saket, South Delhi, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110017',
    lat: 28.5245,
    lng: 77.2066,
    aliases: ['saket', 'malviya nagar', 'press enclave', 'mehroli', 'साकेत', 'मालवीय नगर'],
  },
  {
    id: 'rohini-delhi',
    label: 'Rohini, North-West Delhi',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110085',
    lat: 28.7383,
    lng: 77.0822,
    aliases: ['rohini', 'pitampura', 'pooth khurd', 'रोहिणी', 'पीतमपुरा'],
  },
  {
    id: 'hari-nagar-delhi',
    label: 'Hari Nagar / Janakpuri, West Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110064',
    lat: 28.6279,
    lng: 77.1089,
    aliases: ['hari nagar', 'janakpuri', 'tilak nagar', 'rajouri garden', 'subhash nagar', 'हरि नगर', 'जनकपुरी'],
  },
  {
    id: 'dilshad-garden-delhi',
    label: 'Dilshad Garden / Shahdara, East Delhi',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110095',
    lat: 28.6828,
    lng: 77.3186,
    aliases: ['dilshad garden', 'shahdara', 'east delhi', 'vivek vihar', 'दिलशाद गार्डन', 'शाहदरा'],
  },
  {
    id: 'laxmi-nagar-delhi',
    label: 'Laxmi Nagar / Khichripur, East Delhi',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110092',
    lat: 28.6304,
    lng: 77.2773,
    aliases: ['laxmi nagar', 'mayur vihar', 'khichripur', 'patparganj', 'preet vihar', 'लक्ष्मी नगर', 'मयूर विहार'],
  },
  {
    id: 'okhla-sarita-vihar',
    label: 'Okhla / Sarita Vihar, South-East Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110025',
    lat: 28.5494,
    lng: 77.2788,
    aliases: ['okhla', 'sarita vihar', 'jasola', 'sukhdev vihar', 'jamia nagar', 'kalkaji', 'nehru place', 'ओखला', 'सरिता विहार'],
  },
  {
    id: 'vasant-kunj-dwarka',
    label: 'Vasant Kunj / Mahipalpur, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110070',
    lat: 28.5293,
    lng: 77.1532,
    aliases: ['vasant kunj', 'vasant vihar', 'mahipalpur', 'igi airport', 'वसंत कुंज'],
  },
  {
    id: 'dwarka-delhi',
    label: 'Dwarka, South-West Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110075',
    lat: 28.5921,
    lng: 77.0460,
    aliases: ['dwarka', 'palam', 'uttam nagar', 'najafgarh', 'द्वारका', 'पालम'],
  },
  {
    id: 'civil-lines-delhi',
    label: 'Civil Lines / Kashmere Gate, North Delhi',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110007',
    lat: 28.6769,
    lng: 77.2250,
    aliases: ['civil lines', 'malka ganj', 'kamla nagar', 'kashmere gate', 'jahangirpuri', 'model town', 'dariyaganj', 'chandni chowk', 'चांदनी चौक', 'सिविल लाइन्स'],
  },
  {
    id: 'gurugram-sector-38',
    label: 'Gurugram (Sector 38 / Rajiv Chowk), Haryana',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122001',
    lat: 28.4595,
    lng: 77.0266,
    aliases: ['gurugram', 'gurgaon', 'sector 38', 'sector 44', 'huda city centre', 'dlf cyber city', 'sohna road', 'गुरुग्राम', 'गुड़गांव'],
  },
  {
    id: 'noida-sector-27',
    label: 'Noida (Sector 18 / Sector 27), Uttar Pradesh',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201301',
    lat: 28.5706,
    lng: 77.3261,
    aliases: ['noida', 'sector 18', 'sector 27', 'sector 62', 'botanical garden', 'नोएडा'],
  },
  {
    id: 'greater-noida-kp3',
    label: 'Greater Noida (Knowledge Park / Pari Chowk), UP',
    city: 'Greater Noida',
    state: 'Uttar Pradesh',
    pincode: '201310',
    lat: 28.4744,
    lng: 77.5040,
    aliases: ['greater noida', 'pari chowk', 'knowledge park', 'ग्रेटर नोएडा', 'परी चौक'],
  },
  {
    id: 'ghaziabad-raj-nagar',
    label: 'Ghaziabad (Raj Nagar / Vaishali), Uttar Pradesh',
    city: 'Ghaziabad',
    state: 'Uttar Pradesh',
    pincode: '201002',
    lat: 28.6692,
    lng: 77.4538,
    aliases: ['ghaziabad', 'raj nagar', 'indirapuram', 'vaishali', 'kaushambi', 'गाज़ियाबाद', 'इंदिरापुरम'],
  },
  {
    id: 'faridabad-haryana',
    label: 'Faridabad (NIT / Sector 16), Haryana',
    city: 'Faridabad',
    state: 'Haryana',
    pincode: '121001',
    lat: 28.4089,
    lng: 77.3178,
    aliases: ['faridabad', 'ballabhgarh', 'फरीदाबाद'],
  },

  // ─── OTHER MAJOR INDIAN CITIES & LOCALITIES ───
  {
    id: 'mumbai-parel',
    label: 'Parel / Dadar, Mumbai, Maharashtra',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400012',
    lat: 19.0022,
    lng: 72.8416,
    aliases: ['parel', 'lower parel', 'dadar', 'mumbai', 'bandra', 'andheri', 'borivali', 'thane', 'navi mumbai', 'मुंबई', 'परेल', 'મુંબઈ', 'মুম্বাই'],
  },
  {
    id: 'pune-station',
    label: 'Pune Junction / Shivajinagar, Pune, Maharashtra',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    lat: 18.5204,
    lng: 73.8567,
    aliases: ['pune', 'shivajinagar', 'pimpri', 'chinchwad', 'kothrud', 'hadapsar', 'पुणे'],
  },
  {
    id: 'bengaluru-majestic',
    label: 'Bengaluru (Fort / Majestic / Indiranagar), Karnataka',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560002',
    lat: 12.9716,
    lng: 77.5946,
    aliases: ['bengaluru', 'bangalore', 'fort bengaluru', 'whitefield', 'koramangala', 'jayanagar', 'बेंगलुरु', 'ಬೆಂಗಳೂರು', 'பெங்களூரு'],
  },
  {
    id: 'chennai-park-town',
    label: 'Park Town / Egmore, Chennai, Tamil Nadu',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600003',
    lat: 13.0827,
    lng: 80.2707,
    aliases: ['chennai', 'madras', 'park town', 'egmore', 'adyar', 't nagar', 'tambaram', 'चेन्नई', 'சென்னை'],
  },
  {
    id: 'kolkata-ajc-bose',
    label: 'AJC Bose Road / Esplanade, Kolkata, West Bengal',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700020',
    lat: 22.5450,
    lng: 88.3510,
    aliases: ['kolkata', 'calcutta', 'ajc bose road', 'salt lake', 'howrah', 'park street', 'कोलकाता', 'কলকাতা'],
  },
  {
    id: 'ahmedabad-asarwa',
    label: 'Asarwa / Navrangpura, Ahmedabad, Gujarat',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380016',
    lat: 23.0330,
    lng: 72.5850,
    aliases: ['ahmedabad', 'asarwa', 'navrangpura', 'maninagar', 'gandhinagar', 'अहमदाबाद', 'અમદાવાદ'],
  },
  {
    id: 'jaipur-ashok-nagar',
    label: 'Ashok Nagar / MI Road, Jaipur, Rajasthan',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302004',
    lat: 26.9124,
    lng: 75.7873,
    aliases: ['jaipur', 'ashok nagar jaipur', 'malviya nagar jaipur', 'mansarovar', 'जयपुर'],
  },
  {
    id: 'lucknow-chowk',
    label: 'Chowk / Hazratganj, Lucknow, Uttar Pradesh',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    pincode: '226003',
    lat: 26.8467,
    lng: 80.9462,
    aliases: ['lucknow', 'chowk lucknow', 'hazratganj', 'gomti nagar', 'alambagh', 'raebareli road', 'लखनऊ', 'لکھنؤ'],
  },
  {
    id: 'hyderabad-banjara',
    label: 'Hyderabad (Nampally / Secunderabad), Telangana',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001',
    lat: 17.3850,
    lng: 78.4867,
    aliases: ['hyderabad', 'secunderabad', 'banjara hills', 'gachibowli', 'kukatpally', 'हैदराबाद', 'హైదరాబాద్', 'حیدرآباد'],
  },
  {
    id: 'bhubaneswar-cuttack',
    label: 'Bhubaneswar / Cuttack, Odisha',
    city: 'Bhubaneswar',
    state: 'Odisha',
    pincode: '751001',
    lat: 20.2961,
    lng: 85.8245,
    aliases: ['bhubaneswar', 'cuttack', 'puri', 'odisha', 'भुवनेश्वर', 'ଭୁବନେଶ୍ୱର', 'କଟକ'],
  },
  {
    id: 'kochi-thiruvananthapuram',
    label: 'Kochi / Ernakulam, Kerala',
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682011',
    lat: 9.9312,
    lng: 76.2673,
    aliases: ['kochi', 'cochin', 'ernakulam', 'kerala', 'कोच्चि', 'കൊച്ചി', 'എറണാകുളം'],
  },
  {
    id: 'thiruvananthapuram-kerala',
    label: 'Thiruvananthapuram (Trivandrum), Kerala',
    city: 'Thiruvananthapuram',
    state: 'Kerala',
    pincode: '695011',
    lat: 8.5241,
    lng: 76.9366,
    aliases: ['thiruvananthapuram', 'trivandrum', 'തിരുവനന്തപുരം'],
  },
  {
    id: 'patna-bihar',
    label: 'Patna (PMCH / Bailey Road), Bihar',
    city: 'Patna',
    state: 'Bihar',
    pincode: '800004',
    lat: 25.5941,
    lng: 85.1376,
    aliases: ['patna', 'danapur', 'kankarbagh', 'पटना'],
  },
  {
    id: 'bhopal-mp',
    label: 'Bhopal, Madhya Pradesh',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    pincode: '462001',
    lat: 23.2599,
    lng: 77.4126,
    aliases: ['bhopal', 'indore', 'भोपाल'],
  },
  {
    id: 'chandigarh-pgimer',
    label: 'Chandigarh (Sector 12 / PGIMER)',
    city: 'Chandigarh',
    state: 'Chandigarh',
    pincode: '160012',
    lat: 30.7649,
    lng: 76.7752,
    aliases: ['chandigarh', 'mohali', 'panchkula', 'चंडीगढ़'],
  },
  {
    id: 'varanasi-bhu',
    label: 'Varanasi (Lanka / BHU), Uttar Pradesh',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    pincode: '221005',
    lat: 25.2677,
    lng: 82.9913,
    aliases: ['varanasi', 'banaras', 'kashi', 'लंका', 'वाराणसी', 'बनारस'],
  },
  {
    id: 'nagpur-maharashtra',
    label: 'Nagpur, Maharashtra',
    city: 'Nagpur',
    state: 'Maharashtra',
    pincode: '440001',
    lat: 21.1458,
    lng: 79.0882,
    aliases: ['nagpur', 'नागपुर', 'नागपूर'],
  },
  {
    id: 'dehradun-uk',
    label: 'Dehradun, Uttarakhand',
    city: 'Dehradun',
    state: 'Uttarakhand',
    pincode: '248001',
    lat: 30.3165,
    lng: 78.0322,
    aliases: ['dehradun', 'rishikesh', 'haridwar', 'देहरादून', 'ऋषिकेश'],
  },
];

/**
 * Search the offline Indian gazetteer by locality name, city, state, pincode, or token overlap.
 */
export function searchIndianLocalities(rawQuery: string, limit = 6): IndianLocality[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const tokens = q
    .split(/[\s,.-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const scored: { item: IndianLocality; score: number }[] = [];

  for (const loc of INDIAN_LOCALITIES) {
    const hayLabel = loc.label.toLowerCase();
    const hayCity = loc.city.toLowerCase();
    const hayState = loc.state.toLowerCase();
    const hayAliases = loc.aliases.map((a) => a.toLowerCase());
    let score = 0;

    if (loc.pincode && loc.pincode.startsWith(q)) score += 100;
    if (hayLabel === q || hayCity === q || hayAliases.includes(q)) score += 95;
    if (hayLabel.includes(q)) score += 70;
    if (hayAliases.some((a) => a.includes(q) || q.includes(a))) score += 65;

    for (const tok of tokens) {
      if (loc.pincode === tok) score += 50;
      if (hayAliases.some((a) => a.includes(tok))) score += 25;
      else if (hayLabel.includes(tok)) score += 20;
      else if (hayCity.includes(tok) || hayState.includes(tok)) score += 12;
    }

    if (score > 0) {
      scored.push({ item: loc, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}
