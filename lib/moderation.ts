import { CommunityReview } from '@/data/reviews';

export interface ModerationResult {
  allowed: boolean;
  status: 'approved' | 'rejected';
  reason?: string;
  sanitizedComment: string;
  sanitizedAuthor: string;
}

const PROFANITY_OR_ABUSE_PATTERNS = [
  /\b(fuck|shit|bitch|bastard|asshole|idiot|moron|scam\s*link|casino|viagra|crypto|whatsapp\s*\+?\d+)/i,
  /https?:\/\/\S+/i, // block promotional/spam links in reviews
  /www\.\S+\.\w+/i,
];

const UNSUPPORTED_MEDICAL_OR_DEFAMATION_PATTERNS = [
  /\b(100%\s*cure|miracle\s*cure|guaranteed\s*cure)\b/i,
  /\b(murderer|killer\s+doctor)\b/i,
];

const PHONE_PII_PATTERN = /\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g;

/**
 * NOTE: rate limiting for review submissions now lives in `lib/rate-limit.ts`
 * (`RATE_LIMITS.reviews`, 4 per minute per IP) so every public API route shares
 * one implementation. This module stays focused on content moderation.
 */

export function moderateReviewInput(
  input: {
    hospitalId: string;
    authorAlias?: string;
    comment?: string;
    overall?: number;
  },
  existingReviews: CommunityReview[],
): ModerationResult {
  const rawComment = (input.comment ?? '').trim();
  const rawAuthor = (input.authorAlias ?? '').trim() || 'Community Member';

  // Strip HTML tags & redact personal mobile numbers to protect patient privacy
  const cleanComment = rawComment
    .replace(/<[^>]*>/g, '')
    .replace(PHONE_PII_PATTERN, '[phone redacted]')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanAuthor = rawAuthor
    .replace(/<[^>]*>/g, '')
    .replace(PHONE_PII_PATTERN, '')
    .slice(0, 40)
    .trim() || 'Community Member';

  if (cleanComment.length < 15) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'Review comment must be at least 15 characters describing your visit experience.',
      sanitizedComment: cleanComment,
      sanitizedAuthor: cleanAuthor,
    };
  }

  if (cleanComment.length > 600) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'Review comment must be under 600 characters.',
      sanitizedComment: cleanComment,
      sanitizedAuthor: cleanAuthor,
    };
  }

  // Repeated character spam check (e.g. "aaaaaaaaaaaa")
  if (/(.)\1{7,}/.test(cleanComment)) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'Review appears to contain repetitive spam characters.',
      sanitizedComment: cleanComment,
      sanitizedAuthor: cleanAuthor,
    };
  }

  for (const pat of PROFANITY_OR_ABUSE_PATTERNS) {
    if (pat.test(cleanComment) || pat.test(cleanAuthor)) {
      return {
        allowed: false,
        status: 'rejected',
        reason: 'Review blocked by moderation: external URLs, promotional spam, or abusive language are not permitted.',
        sanitizedComment: cleanComment,
        sanitizedAuthor: cleanAuthor,
      };
    }
  }

  for (const pat of UNSUPPORTED_MEDICAL_OR_DEFAMATION_PATTERNS) {
    if (pat.test(cleanComment)) {
      return {
        allowed: false,
        status: 'rejected',
        reason: 'Review blocked: unsupported miracle-cure claims or unverified criminal accusations violate JeevanSetu review guidelines.',
        sanitizedComment: cleanComment,
        sanitizedAuthor: cleanAuthor,
      };
    }
  }

  // Duplicate check on same hospital
  const normalized = cleanComment.toLowerCase();
  const isDuplicate = existingReviews.some(
    (r) => r.hospitalId === input.hospitalId && r.comment.trim().toLowerCase() === normalized,
  );
  if (isDuplicate) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'An identical review has already been submitted for this hospital.',
      sanitizedComment: cleanComment,
      sanitizedAuthor: cleanAuthor,
    };
  }

  return {
    allowed: true,
    status: 'approved',
    sanitizedComment: cleanComment,
    sanitizedAuthor: cleanAuthor,
  };
}
