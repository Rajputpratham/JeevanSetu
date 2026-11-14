'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Star, ShieldCheck, ExternalLink, MessageSquarePlus, AlertCircle, CheckCircle2, Info, Loader2,
} from 'lucide-react';
import { useLang } from '@/lib/i18n';
import type { CommunityScoreSummary } from '@/lib/ratings';
import type { CommunityReview } from '@/data/reviews';
import type { GoogleRatingResponse } from '@/app/api/google-ratings/route';

interface Props {
  hospitalId: string;
  hospitalName: string;
}

export default function RatingsSection({ hospitalId, hospitalName }: Props) {
  const { t } = useLang();
  const [summary, setSummary] = useState<CommunityScoreSummary | null>(null);
  const [reviews, setReviews] = useState<CommunityReview[]>([]);
  const [googleData, setGoogleData] = useState<GoogleRatingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Review form state
  const [formOpen, setFormOpen] = useState(false);
  const [authorAlias, setAuthorAlias] = useState('');
  const [visitType, setVisitType] = useState<CommunityReview['visitType']>('OPD');
  const [overall, setOverall] = useState<number>(4);
  const [doctorCare, setDoctorCare] = useState<number>(4);
  const [cleanliness, setCleanliness] = useState<number>(4);
  const [waitTime, setWaitTime] = useState<number>(3);
  const [billingTransparency, setBillingTransparency] = useState<number>(4);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadRatings = useCallback(async () => {
    setLoading(true);
    try {
      const [commRes, googRes] = await Promise.all([
        fetch(`/api/reviews?hospitalId=${encodeURIComponent(hospitalId)}`),
        fetch(`/api/google-ratings?hospitalId=${encodeURIComponent(hospitalId)}`),
      ]);
      if (commRes.ok) {
        const commJson = await commRes.json();
        setSummary(commJson.summary ?? null);
        setReviews(commJson.reviews ?? []);
      }
      if (googRes.ok) {
        const googJson = await googRes.json();
        setGoogleData(googJson);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  const onSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId,
          authorAlias,
          visitType,
          overall,
          doctorCare,
          cleanliness,
          waitTime,
          billingTransparency,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Moderation rejected this review.');
        return;
      }
      setSummary(data.summary);
      setReviews(data.reviews ?? []);
      setComment('');
      setAuthorAlias('');
      setSubmitSuccess(true);
      setFormOpen(false);
    } catch {
      setSubmitError('Network error while submitting review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="ratings-heading" className="card p-5 sm:p-6" data-testid="ratings-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ratings-heading" className="flex items-center gap-2 font-extrabold text-lg text-slate-900">
          <Star className="text-amber-500 fill-amber-500" size={20} />
          {t('communityScoreLabel')} &amp; {t('googleRatingLabel')}
        </h2>
        <button
          type="button"
          onClick={() => {
            setFormOpen((v) => !v);
            setSubmitError(null);
          }}
          className="btn-secondary !py-2 !px-3.5 !text-xs !min-h-[40px]"
        >
          <MessageSquarePlus size={15} /> {t('writeReviewTitle')}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 grid sm:grid-cols-2 gap-4 animate-pulse">
          <div className="h-36 rounded-2xl bg-slate-100" />
          <div className="h-36 rounded-2xl bg-slate-100" />
        </div>
      ) : (
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          {/* 1. Separate JeevanSetu IMDb-style Community Score Card */}
          <div
            className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-4 flex flex-col justify-between"
            data-testid="community-score-card"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
                  {t('communityScoreLabel')}
                </span>
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                  IMDb-style Bayesian
                </span>
              </div>

              {summary && summary.imdbScaleScore !== null ? (
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-4xl font-black text-slate-900">
                    {summary.imdbScaleScore.toFixed(1)}
                    <span className="text-lg font-bold text-slate-500">/10</span>
                  </span>
                  <span className="text-xs text-slate-600">
                    ({summary.weightedStarScore?.toFixed(2)} ★ · {summary.eligibleCount} community{' '}
                    {summary.eligibleCount === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold text-slate-600">
                  Not yet scored — 0 eligible community reviews. Be the first to share your experience.
                </p>
              )}

              {/* 5-star distribution bars */}
              {summary && summary.eligibleCount > 0 && (
                <div className="mt-3 space-y-1" data-testid="review-distribution">
                  {([5, 4, 3, 2, 1] as const).map((star) => {
                    const count = summary.distribution[star] ?? 0;
                    const pct = Math.round((count / summary.eligibleCount) * 100);
                    return (
                      <div key={star} className="flex items-center gap-2 text-[11px]">
                        <span className="w-7 font-bold text-slate-700">{star} ★</span>
                        <div className="flex-1 h-2 rounded-full bg-amber-100 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-slate-500">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sub-metrics */}
              {summary && summary.eligibleCount > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="rounded-lg bg-white px-2.5 py-1.5 border border-amber-100 flex justify-between">
                    <span className="text-slate-600">Doctor Care</span>
                    <strong className="text-slate-900">{summary.subMetrics.doctorCare}/5</strong>
                  </div>
                  <div className="rounded-lg bg-white px-2.5 py-1.5 border border-amber-100 flex justify-between">
                    <span className="text-slate-600">Cleanliness</span>
                    <strong className="text-slate-900">{summary.subMetrics.cleanliness}/5</strong>
                  </div>
                  <div className="rounded-lg bg-white px-2.5 py-1.5 border border-amber-100 flex justify-between">
                    <span className="text-slate-600">Queue / Wait</span>
                    <strong className="text-slate-900">{summary.subMetrics.waitTime}/5</strong>
                  </div>
                  <div className="rounded-lg bg-white px-2.5 py-1.5 border border-amber-100 flex justify-between">
                    <span className="text-slate-600">Billing Clarity</span>
                    <strong className="text-slate-900">{summary.subMetrics.billingTransparency}/5</strong>
                  </div>
                </div>
              )}
            </div>

            {summary && (
              <p className="mt-3 text-[10px] text-slate-500 leading-snug">{summary.formulaNote}</p>
            )}
          </div>

          {/* 2. Separate Google Places Rating Card (Never mixed with Community Score) */}
          <div
            className="rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between"
            data-testid="google-rating-card"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  {t('googleRatingLabel')}
                </span>
                <span className="rounded-full bg-white border border-slate-300 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                  {googleData?.attribution ?? 'Google Maps'}
                </span>
              </div>

              {googleData?.status === 'connected' && googleData.rating !== null ? (
                <div className="mt-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-4xl font-black text-slate-900">
                      {googleData.rating.toFixed(1)}
                      <span className="text-lg font-bold text-slate-500">/5</span>
                    </span>
                    <span className="text-xs text-slate-600">
                      ({googleData.userRatingsTotal?.toLocaleString('en-IN') ?? 0} Google ratings)
                    </span>
                  </div>
                  {googleData.reviews.length > 0 && (
                    <ul className="mt-3 space-y-2 text-xs text-slate-700">
                      {googleData.reviews.slice(0, 2).map((rv, idx) => (
                        <li key={idx} className="rounded-xl bg-white p-2.5 border border-slate-200">
                          <div className="flex justify-between font-bold text-[11px]">
                            <span>{rv.authorName}</span>
                            <span>{rv.rating} ★</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-slate-600">{rv.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-white border border-slate-200 p-3.5">
                  <p className="text-xs font-bold text-slate-800">
                    {googleData?.status === 'awaiting-api-key'
                      ? 'Live Google Places API not configured in this environment'
                      : 'Live Google rating unavailable right now'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                    {googleData?.note ??
                      'JeevanSetu never displays fabricated Google ratings. Open Google Maps below to inspect live public ratings and reviews for this hospital.'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">Kept strictly separate from Community Score</span>
              <a
                href={
                  googleData?.googleMapsUrl ??
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospitalName)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-800 hover:underline"
              >
                View on Google Maps <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Submission feedback */}
      {submitSuccess && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold text-green-900 flex items-center gap-2"
        >
          <CheckCircle2 size={16} className="text-green-700 shrink-0" />
          Thank you! Your review passed automated moderation and has been included in the Community Score.
        </div>
      )}

      {/* Native Review Submission Form */}
      {formOpen && (
        <form
          onSubmit={onSubmitReview}
          className="mt-5 rounded-2xl border-2 border-brand-200 bg-brand-50/40 p-4 sm:p-5 space-y-4"
          aria-label={t('writeReviewTitle')}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">{t('writeReviewTitle')}</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Screened for spam, external links, personal phone numbers, and unsupported miracle-cure claims. Labelled honestly as Community Submitted (Unverified Visit).
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="rev-alias" className="label !text-xs">
                Your Name / Initials (optional)
              </label>
              <input
                id="rev-alias"
                value={authorAlias}
                onChange={(e) => setAuthorAlias(e.target.value)}
                placeholder="e.g. Sunita K."
                maxLength={40}
                className="input !py-2 !text-sm !min-h-[42px]"
              />
            </div>
            <div>
              <label htmlFor="rev-visit" className="label !text-xs">
                Department / Visit Type
              </label>
              <select
                id="rev-visit"
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as CommunityReview['visitType'])}
                className="input !py-2 !text-sm !min-h-[42px]"
              >
                <option value="OPD">OPD Consultation</option>
                <option value="Emergency">Emergency / Casualty</option>
                <option value="Inpatient">Inpatient Admission</option>
                <option value="Maternity">Maternity &amp; Delivery</option>
                <option value="Diagnostics">Diagnostics / Lab</option>
              </select>
            </div>
            <div>
              <label htmlFor="rev-overall" className="label !text-xs">
                Overall Experience (1–5 ★)
              </label>
              <select
                id="rev-overall"
                value={overall}
                onChange={(e) => setOverall(Number(e.target.value))}
                className="input !py-2 !text-sm !min-h-[42px]"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} ★
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { id: 'm-doc', label: 'Doctor Care', val: doctorCare, set: setDoctorCare },
              { id: 'm-clean', label: 'Cleanliness', val: cleanliness, set: setCleanliness },
              { id: 'm-wait', label: 'Queue / Wait', val: waitTime, set: setWaitTime },
              { id: 'm-bill', label: 'Billing Clarity', val: billingTransparency, set: setBillingTransparency },
            ].map((m) => (
              <div key={m.id}>
                <label htmlFor={m.id} className="font-semibold text-slate-700 block mb-1">
                  {m.label}
                </label>
                <select
                  id={m.id}
                  value={m.val}
                  onChange={(e) => m.set(Number(e.target.value))}
                  className="input !py-1.5 !px-2.5 !text-xs !min-h-[38px]"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} / 5
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="rev-comment" className="label !text-xs">
              Helpful details for other families (15–600 chars) *
            </label>
            <textarea
              id="rev-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              minLength={15}
              maxLength={600}
              placeholder="Share practical tips: OPD registration timing, cleanliness, billing transparency, or facilities…"
              className="input min-h-[90px] !text-sm"
            />
          </div>

          {submitError && (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-bold text-red-700">
              <AlertCircle size={15} className="shrink-0" /> {submitError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-primary !py-2.5 !text-sm">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}{' '}
              {t('submitReviewBtn')}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="btn-ghost !py-2.5 !text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Community Reviews List */}
      {reviews.length > 0 && (
        <div className="mt-5 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Recent Community Experience Reports ({reviews.length})
          </h3>
          {reviews.slice(0, 6).map((rev) => (
            <article
              key={rev.id}
              className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{rev.authorAlias}</span>
                  <span className="chip !py-0.5 !px-2 !text-[10px]">{rev.visitType}</span>
                  <span className="chip-grey !py-0.5 !px-2 !text-[10px]">
                    {rev.isDemoSeed
                      ? 'Community Seed (Unverified Visit)'
                      : 'Community Submitted (Unverified Visit)'}
                  </span>
                </div>
                <span className="font-extrabold text-amber-700 text-xs">
                  {'★'.repeat(rev.overall)}{'☆'.repeat(5 - rev.overall)} ({rev.overall}/5)
                </span>
              </div>
              <p className="mt-2 text-slate-700 leading-relaxed text-[13px]">{rev.comment}</p>
            </article>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-500 flex items-start gap-1.5">
        <Info size={13} className="mt-0.5 shrink-0" />
        Ratings reflect patient and family experience perceptions (queues, cleanliness, billing clarity) — they are not clinical survival or medical-quality audits.
      </p>
    </section>
  );
}
