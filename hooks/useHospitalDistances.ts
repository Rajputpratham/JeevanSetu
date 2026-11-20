'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { forgetDistanceFallback, getDrivingDistances, type DistanceResult, type Hospital, type LatLng } from '@/lib/distance';

const keyFor = ({ id, lat, lng }: Hospital) => JSON.stringify([id, lat, lng]);

export function useHospitalDistances(origin: LatLng | null, hospitals: readonly Hospital[]) {
  const [snapshot, setSnapshot] = useState<{ origin: LatLng; results: Map<string, DistanceResult> } | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!origin || !hospitals.length) return;
    let current = true;
    const timer = setTimeout(() => {
      void getDrivingDistances(origin, hospitals).then((results) => {
        if (!current) return;
        setSnapshot({ origin, results: new Map(results.map((result, index) => [keyFor(hospitals[index]), result])) });
        setRetrying(new Set());
      });
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [origin, hospitals, retryVersion]);

  const retry = useCallback((hospital: Hospital) => {
    if (!origin) return;
    forgetDistanceFallback(origin, hospital);
    setRetrying((ids) => new Set(ids).add(hospital.id));
    setRetryVersion((version) => version + 1);
  }, [origin]);

  const distances = useMemo(() => {
    const visible = new Map<string, DistanceResult>();
    if (snapshot?.origin === origin) {
      hospitals.forEach((hospital) => {
        const result = snapshot.results.get(keyFor(hospital));
        if (result && !retrying.has(hospital.id)) visible.set(hospital.id, result);
      });
    }
    return visible;
  }, [hospitals, origin, retrying, snapshot]);

  return { distances, retry };
}
