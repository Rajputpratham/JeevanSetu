import { Treatment } from '@/data/types';
import { tTreatmentTest } from './i18n-data';
import type { Lang } from './lang-meta';

export type RoomType = 'general' | 'semi-private' | 'private' | 'icu';
export const ROOM_MULTIPLIER: Record<RoomType, number> = {
  general: 1,
  'semi-private': 1.8,
  private: 3,
  icu: 4.5,
};
export const ROOM_LABEL: Record<RoomType, string> = {
  general: 'General ward',
  'semi-private': 'Semi-private room',
  private: 'Private room',
  icu: 'ICU',
};
export const ROOM_LABEL_HI: Record<RoomType, string> = {
  general: 'जनरल वार्ड',
  'semi-private': 'सेमी-प्राइवेट कमरा',
  private: 'प्राइवेट कमरा',
  icu: 'ICU',
};

export interface EstimateInput {
  treatmentId: string;
  /** indices of tests to include */
  includedTests: number[];
  /** number of nights; clamped to >= 0 */
  stayDays: number;
  roomType: RoomType;
}

export interface EstimateLine {
  label: string;
  govt: [number, number];
  private: [number, number];
  unavailable?: boolean;
}
export interface EstimateResult {
  treatment: Treatment;
  lines: EstimateLine[];
  govtTotal: [number, number];
  privateTotal: [number, number];
  unavailableComponents: string[];
  disclaimer: string;
}

export const ESTIMATE_DISCLAIMER =
  'These are indicative ranges from public references, not a quotation. Actual bills depend on the city, hospital, room type, complications and length of stay. Government hospitals are often far cheaper — some services (e.g., deliveries under JSY, dialysis under PMNDP, cataract surgery) are free for eligible patients. Always ask the hospital for a written estimate.';

export const ESTIMATE_DISCLAIMER_HI =
  'ये सार्वजनिक संदर्भों पर आधारित अनुमानित सीमाएं हैं, कोई पक्का कोटेशन नहीं। वास्तविक बिल शहर, अस्पताल, कमरे की श्रेणी, जटिलताओं और भर्ती रहने के दिनों पर निर्भर करता है। सरकारी अस्पताल अक्सर बहुत सस्ते होते हैं — कुछ सेवाएं (जैसे JSY के तहत प्रसव, PMNDP के तहत डायलिसिस, मोतियाबिंद सर्जरी) पात्र मरीजों के लिए मुफ़्त हैं। अस्पताल से हमेशा लिखित अनुमान मांगें।';

export function estimateTreatment(
  treatment: Treatment,
  input: EstimateInput,
  lang: Lang = 'en',
): EstimateResult {
  const lines: EstimateLine[] = [];
  const unavailable: string[] = [];
  const hi = lang === 'hi';

  lines.push({
    label: hi ? 'परामर्श / पंजीकरण' : 'Consultation / registration',
    govt: treatment.consultation.govt,
    private: treatment.consultation.private,
  });

  treatment.tests.forEach((test, i) => {
    if (input.includedTests.includes(i)) {
      lines.push({
        label: tTreatmentTest(test.name, lang),
        govt: test.govt,
        private: test.private,
      });
    }
  });

  const procLabel = hi ? 'प्रक्रिया / सर्जरी शुल्क' : 'Procedure / surgery charges';
  if (treatment.procedure) {
    lines.push({
      label: procLabel,
      govt: treatment.procedure.govt,
      private: treatment.procedure.private,
    });
  } else {
    unavailable.push(procLabel);
    lines.push({
      label: procLabel,
      govt: [0, 0],
      private: [0, 0],
      unavailable: true,
    });
  }

  if (treatment.roomPerDay) {
    const mult = ROOM_MULTIPLIER[input.roomType];
    const days = Math.max(0, input.stayDays);
    const [gLo, gHi] = treatment.roomPerDay.govt;
    const [pLo, pHi] = treatment.roomPerDay.private;
    const roomLabel = hi ? ROOM_LABEL_HI[input.roomType] : ROOM_LABEL[input.roomType];
    const roomLine = hi
      ? `कमरा शुल्क (${days} ${days === 1 ? 'रात' : 'रातें'}, ${roomLabel})`
      : `Room charges (${days} night${days === 1 ? '' : 's'}, ${roomLabel})`;
    lines.push({
      label: roomLine,
      govt: [gLo * mult * days, gHi * mult * days],
      private: [pLo * mult * days, pHi * mult * days],
    });
  }

  lines.push({
    label: hi ? 'दवाइयां' : 'Medicines',
    govt: treatment.medicines.govt,
    private: treatment.medicines.private,
  });

  const sum = (sel: 'govt' | 'private'): [number, number] => {
    let lo = 0, hiVal = 0;
    for (const l of lines) {
      if (l.unavailable) continue;
      lo += l[sel][0];
      hiVal += l[sel][1];
    }
    return [Math.round(lo), Math.round(hiVal)];
  };

  return {
    treatment,
    lines,
    govtTotal: sum('govt'),
    privateTotal: sum('private'),
    unavailableComponents: unavailable,
    disclaimer: hi ? ESTIMATE_DISCLAIMER_HI : ESTIMATE_DISCLAIMER,
  };
}
