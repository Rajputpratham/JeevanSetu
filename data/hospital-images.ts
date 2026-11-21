/**
 * HOSPITAL IMAGE PROVENANCE — why every branch shows an illustration.
 *
 * PROBLEM THIS FIXES
 *   The detail page used to render `public/images/hospital-govt.jpg` or
 *   `hospital-private.jpg` — generic stock photos of a real-looking hospital
 *   building — for EVERY hospital, with the caption "Representative image". A
 *   large photo of an unrelated building is misleading even when captioned, so
 *   both files were deleted from `public/images/`.
 *
 * RULE
 *   A photograph is shown only when `photo` is present AND it depicts this exact
 *   branch AND the rights/attribution are recorded. Otherwise the page renders a
 *   neutral vector illustration that is unmistakably generic.
 *
 * NONE OF THE 35 BRANCHES HAS A VERIFIED PHOTO. We did not look for watermark-free
 * copies of hospital facades: the rights situation for almost every published
 * exterior is unresolved, and reusing a group photo for a different branch is
 * exactly the failure mode being fixed. Adding a photo requires:
 *   - the exact branch (street address confirmed against data/hospital-locations),
 *   - `rights` naming the licence/owner and `attribution` text the licence needs,
 *   - `sourceUrl` pointing at the original, and
 *   - a locally stored copy in `public/images/hospitals/` (never hot-linked).
 */

export type ImageRights =
  | { kind: 'own-work'; licence: string }
  | { kind: 'cc-by'; licence: string; attribution: string }
  | { kind: 'cc-by-sa'; licence: string; attribution: string }
  | { kind: 'permission'; licence: string; attribution: string; grantedOn: string }
  | { kind: 'public-domain'; licence: string };

export interface HospitalPhoto {
  /** Local path inside /public. Never a hot-link. */
  src: string;
  /** Alt text describing what the photo actually shows. */
  alt: string;
  width: number;
  height: number;
  /** What the photo shows, in words, so it can be re-checked. */
  depicts: string;
  /** Exact branch this photo belongs to. Must equal the hospital id. */
  branchId: string;
  rights: ImageRights;
  sourceUrl: string;
  /** Date the branch match and rights were confirmed (YYYY-MM-DD). */
  verifiedOn: string;
}

/**
 * Verified branch photographs. Empty by design — see the header note.
 * Keyed by hospital id so a photo can never float to another branch.
 */
export const HOSPITAL_PHOTOS: Record<string, HospitalPhoto> = {};

/** The only fallback visual: clearly an illustration, not a photograph. */
export const NEUTRAL_ILLUSTRATION = {
  src: '/images/hospital-illustration-neutral.png',
  width: 1456,
  height: 728,
} as const;

export function photoFor(hospitalId: string): HospitalPhoto | null {
  const photo = HOSPITAL_PHOTOS[hospitalId];
  if (!photo) return null;
  // Belt-and-braces: a record keyed to one branch can never render for another.
  if (photo.branchId !== hospitalId) return null;
  if (!photo.rights || !photo.sourceUrl) return null;
  return photo;
}
