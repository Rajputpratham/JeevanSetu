import { NextRequest, NextResponse } from 'next/server';
import { calculateRoute } from '@/lib/routing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const fromLat = parseFloat(sp.get('fromLat') ?? '');
    const fromLng = parseFloat(sp.get('fromLng') ?? '');
    const toLat = parseFloat(sp.get('toLat') ?? '');
    const toLng = parseFloat(sp.get('toLng') ?? '');

    if ([fromLat, fromLng, toLat, toLng].some((v) => Number.isNaN(v) || !Number.isFinite(v))) {
      return NextResponse.json({ error: 'Invalid origin or destination coordinates.' }, { status: 400 });
    }
    if (Math.abs(fromLat) > 90 || Math.abs(toLat) > 90 || Math.abs(fromLng) > 180 || Math.abs(toLng) > 180) {
      return NextResponse.json({ error: 'Coordinates out of valid geographic bounds.' }, { status: 400 });
    }

    const route = await calculateRoute(fromLat, fromLng, toLat, toLng);
    return NextResponse.json(route);
  } catch (err) {
    console.error('[api/route]', err);
    return NextResponse.json({ error: 'Could not compute route.' }, { status: 500 });
  }
}
