import { NextResponse } from 'next/server';
import { TRAVEL_API_SURFACE } from '@/lib/travel';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — configuration & capability probe.
 *
 * Deliberately reports only whether a credential is PRESENT, never its value,
 * and never claims a capability is working just because a key exists. A missing
 * key is a supported state: the app degrades honestly rather than guessing.
 */
export async function GET() {
  const serverRoutesKey = Boolean(process.env.GOOGLE_MAPS_API_KEY);
  const browserMapsKey = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
  );
  const placesKey = Boolean(process.env.GOOGLE_PLACES_API_KEY);
  const geminiKey = Boolean(process.env.GEMINI_API_KEY);

  return NextResponse.json({
    status: 'ok',
    generatedAt: new Date().toISOString(),
    capabilities: {
      /** Live Google driving distance + traffic-aware ETA. */
      drivingDistance: {
        configured: serverRoutesKey,
        envVar: 'GOOGLE_MAPS_API_KEY',
        whenMissing: 'Driving distance and ETA are reported as unavailable everywhere. No value is estimated.',
        ...TRAVEL_API_SURFACE,
      },
      /** Interactive Google Map on discovery / detail pages. */
      interactiveMap: {
        configured: browserMapsKey,
        envVar: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
        whenMissing: 'A configuration notice replaces the map. Lists, distances and directions keep working.',
      },
      /** Google Places ratings & review snippets. */
      googleRatings: {
        configured: placesKey,
        envVar: 'GOOGLE_PLACES_API_KEY',
        whenMissing: 'Ratings show the JeevanSetu community score and state that Google ratings are unavailable.',
      },
      /** Gemini phrasing layer for the assistant. */
      assistantLanguage: {
        configured: geminiKey,
        envVar: 'GEMINI_API_KEY',
        textModel: process.env.GEMINI_TEXT_MODEL ?? 'gemini-2.5-flash',
        liveModel: process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.5-flash-native-audio-preview-09-2025',
        whenMissing:
          'The assistant answers from the deterministic rule engine and labels the reply as such (groundingMode: deterministic-grounded).',
      },
    },
    guarantees: [
      'No driving distance, ETA or traffic figure is ever estimated or modelled.',
      'Unknown data is labelled unknown rather than filled in with a default city or a guess.',
      'Greetings never trigger a hospital search.',
      'No diagnosis, prescription or live bed-availability claim is ever produced.',
    ],
  });
}
