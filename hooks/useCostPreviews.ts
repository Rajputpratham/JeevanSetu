'use client';

import { useEffect, useRef, useState } from 'react';
import type { CostPreviewPayload } from '@/components/costs/CostPreview';

interface Snapshot {
  key: string;
  byId: Record<string, CostPreviewPayload>;
  treatmentName: string;
}

/**
 * One batched request per (treatment, visible hospital set) — never one request
 * per card, and never on every render. Cards read from the map.
 */
export function useCostPreviews(
  treatmentId: string | null,
  hospitalIds: readonly string[],
  lang: string,
) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const idsKey = hospitalIds.join(',');
  const key = `${treatmentId ?? ''}|${lang}|${idsKey}`;

  useEffect(() => {
    if (!treatmentId || !hospitalIds.length) {
      setSnapshot(null);
      setFailed(false);
      return;
    }
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setFailed(false);
    const timer = setTimeout(() => {
      fetch(
        `/api/cost-preview?treatment=${encodeURIComponent(treatmentId)}&ids=${encodeURIComponent(idsKey)}&lang=${lang}`,
        { signal: c.signal, cache: 'no-store' },
      )
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad response'))))
        .then((data) => {
          if (c.signal.aborted) return;
          const byId: Record<string, CostPreviewPayload> = {};
          for (const row of data.results ?? []) byId[row.hospitalId] = row;
          setSnapshot({ key, byId, treatmentName: data.treatment?.name ?? '' });
        })
        .catch(() => {
          if (!c.signal.aborted) setFailed(true);
        });
    }, 200);
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [treatmentId, idsKey, lang, key, hospitalIds.length]);

  const ready = snapshot?.key === key;
  return {
    loading: Boolean(treatmentId) && !ready && !failed,
    failed,
    treatmentName: ready ? snapshot!.treatmentName : '',
    forHospital: (id: string): CostPreviewPayload | null => (ready ? snapshot!.byId[id] ?? null : null),
  };
}
