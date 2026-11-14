import { Treatment } from '@/data/types';

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

export function estimateTreatment(treatment: Treatment, input: EstimateInput): EstimateResult {
  const lines: EstimateLine[] = [];
  const unavailable: string[] = [];

  lines.push({
    label: 'Consultation / registration',
    govt: treatment.consultation.govt,
    private: treatment.consultation.private,
  });

  treatment.tests.forEach((test, i) => {
    if (input.includedTests.includes(i)) {
      lines.push({ label: test.name, govt: test.govt, private: test.private });
    }
  });

  if (treatment.procedure) {
    lines.push({
      label: 'Procedure / surgery charges',
      govt: treatment.procedure.govt,
      private: treatment.procedure.private,
    });
  } else {
    unavailable.push('Procedure / surgery charges');
    lines.push({
      label: 'Procedure / surgery charges',
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
    lines.push({
      label: `Room charges (${days} night${days === 1 ? '' : 's'}, ${ROOM_LABEL[input.roomType]})`,
      govt: [gLo * mult * days, gHi * mult * days],
      private: [pLo * mult * days, pHi * mult * days],
    });
  }

  lines.push({
    label: 'Medicines',
    govt: treatment.medicines.govt,
    private: treatment.medicines.private,
  });

  const sum = (sel: 'govt' | 'private'): [number, number] => {
    let lo = 0, hi = 0;
    for (const l of lines) {
      if (l.unavailable) continue;
      lo += l[sel][0];
      hi += l[sel][1];
    }
    return [Math.round(lo), Math.round(hi)];
  };

  return {
    treatment,
    lines,
    govtTotal: sum('govt'),
    privateTotal: sum('private'),
    unavailableComponents: unavailable,
    disclaimer: ESTIMATE_DISCLAIMER,
  };
}
