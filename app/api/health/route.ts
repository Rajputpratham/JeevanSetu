import { NextResponse } from 'next/server';

/**
 * Liveness probe used by the Render web service (render.yaml → healthCheckPath).
 * Kept dependency-free and uncached so it responds instantly, including on a
 * cold start after a free-tier instance has been idle.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'jeevansetu',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
