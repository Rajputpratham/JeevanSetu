import { NextRequest, NextResponse } from 'next/server';
import { getHospitalById } from '@/data/hospitals';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const hospital = getHospitalById(id);
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
    }
    return NextResponse.json({ hospital });
  } catch (err) {
    console.error('[api/hospitals/[id]]', err);
    return NextResponse.json({ error: 'Failed to load hospital details.' }, { status: 500 });
  }
}
