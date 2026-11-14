'use client';
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

const STORAGE = 'jeevansetu-saved';

interface SavedCtx {
  savedIds: string[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => boolean;
  clearSaved: () => void;
}

const Ctx = createContext<SavedCtx>({
  savedIds: [],
  isSaved: () => false,
  toggleSaved: () => false,
  clearSaved: () => {},
});

export function SavedProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedIds(parsed.filter((x) => typeof x === 'string'));
        }
      }
    } catch { /* ignore */ }
  }, []);

  const toggleSaved = useCallback((id: string) => {
    let added = false;
    setSavedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      added = !exists;
      try { window.localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    return added;
  }, []);

  const clearSaved = useCallback(() => {
    setSavedIds([]);
    try { window.localStorage.setItem(STORAGE, JSON.stringify([])); } catch { /* ignore */ }
  }, []);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  return (
    <Ctx.Provider value={{ savedIds, isSaved, toggleSaved, clearSaved }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSavedHospitals() {
  return useContext(Ctx);
}
