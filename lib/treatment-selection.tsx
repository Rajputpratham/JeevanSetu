'use client';

/**
 * Cross-page "which treatment are we pricing?" selection.
 *
 * The estimator links to `/hospitals?treatment=<id>`, and both pages read/write
 * the same session value so a family can move estimator → results → detail
 * without re-picking. Session storage only: no account, no server state, and the
 * value is a treatment id — never anything personal.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'jeevansetu:treatment:v1';

interface Ctx {
  treatmentId: string | null;
  setTreatmentId: (id: string | null) => void;
}

const TreatmentCtx = createContext<Ctx>({ treatmentId: null, setTreatmentId: () => {} });

export function TreatmentProvider({ children, initial }: { children: ReactNode; initial?: string | null }) {
  const [treatmentId, setState] = useState<string | null>(initial ?? null);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) setState((current) => current ?? stored);
      else if (initial) window.sessionStorage.setItem(STORAGE_KEY, initial);
    } catch {
      /* storage disabled — the in-memory value still works */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTreatmentId = useCallback((id: string | null) => {
    setState(id);
    try {
      if (id) window.sessionStorage.setItem(STORAGE_KEY, id);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ treatmentId, setTreatmentId }), [treatmentId, setTreatmentId]);
  return <TreatmentCtx.Provider value={value}>{children}</TreatmentCtx.Provider>;
}

export function useTreatmentSelection() {
  return useContext(TreatmentCtx);
}

/** Read the selection outside React (e.g. a one-off fetch helper). */
export function readStoredTreatment(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
