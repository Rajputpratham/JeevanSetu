'use client';

import { formatDistance, type DistanceResult, type LatLng } from '@/lib/distance';
import { LOCATION_DISCLOSURE_ID } from './FinderLocationControls';

export interface FinderDistance {
  origin: LatLng | null;
  verified: boolean;
  result?: DistanceResult;
  error: string | null;
  locating: boolean;
  enable: () => void;
  retry: () => void;
}

export default function FinderDistanceBadge({ origin, verified, result, error, locating, enable, retry }: FinderDistance) {
  const actionStyle = 'min-h-[44px] text-xs font-bold text-brand-800 underline underline-offset-2';
  let message: string;
  let action: { label: string; run: () => void; describe?: string } | undefined;
  if (!verified) message = 'Location not available for this hospital.';
  else if (locating) message = 'Getting your location…';
  else if (error) {
    message = error;
    action = { label: 'Retry location', run: enable, describe: LOCATION_DISCLOSURE_ID };
  } else if (!origin) {
    message = 'Enable location to see distance';
    action = { label: 'Enable', run: enable, describe: LOCATION_DISCLOSURE_ID };
  } else if (!result) message = 'Calculating…';
  else {
    message = formatDistance(result);
    if (result.source === 'straight-line') action = { label: 'Retry route', run: retry };
  }

  return (
    <div className="w-[38%] max-w-[148px] shrink-0 text-right" data-testid="card-distance-block">
      <p className={`break-words text-xs font-bold leading-tight ${result?.source === 'road' ? 'text-brand-800' : 'text-slate-700'}`} data-testid="card-distance">
        {message}
      </p>
      {result?.source === 'road' && <p className="mt-1 text-[10px] leading-tight text-slate-500">Estimated driving route</p>}
      {action && <button type="button" className={actionStyle} aria-describedby={action.describe}
        onClick={(event) => { event.stopPropagation(); action.run(); }}>{action.label}</button>}
    </div>
  );
}
