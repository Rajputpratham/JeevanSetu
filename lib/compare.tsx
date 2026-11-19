'use client';
/**
 * Comparison selection store — persisted in localStorage so it survives
 * navigation and reloads. Max 3 hospitals.
 */
import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from 'react';

const STORAGE = 'jeevansetu-compare';
export const MAX_COMPARE = 3;

interface CompareCtx {
  ids: string[];
  add: (id: string) => boolean;
  remove: (id: string) => void;
  toggle: (id: string) => boolean;
  clear: () => void;
  has: (id: string) => boolean;
  full: boolean;
}
const Ctx = createContext<CompareCtx>({
  ids: [], add: () => false, remove: () => {}, toggle: () => false,
  clear: () => {}, has: () => false, full: false,
});

export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE);
      if (saved) setIds(Array.from(new Set((JSON.parse(saved) as string[]).filter((x) => typeof x === 'string'))).slice(0, MAX_COMPARE));
    } catch { /* ignore */ }
  }, []);

  const persist = useCallback((next: string[]) => {
    setIds(next);
    try { window.localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const add = useCallback((id: string) => {
    let ok = false;
    setIds((prev) => {
      if (prev.includes(id)) { ok = true; return prev; }
      if (prev.length >= MAX_COMPARE) return prev;
      ok = true;
      const next = [...prev, id];
      try { window.localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    return ok;
  }, []);

  const remove = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.filter((x) => x !== id);
      try { window.localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    let added = false;
    setIds((prev) => {
      let next: string[];
      if (prev.includes(id)) next = prev.filter((x) => x !== id);
      else if (prev.length < MAX_COMPARE) { next = [...prev, id]; added = true; }
      else return prev;
      try { window.localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    return added;
  }, []);

  const clear = useCallback(() => persist([]), [persist]);
  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return (
    <Ctx.Provider value={{ ids, add, remove, toggle, clear, has, full: ids.length >= MAX_COMPARE }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCompare() {
  return useContext(Ctx);
}
