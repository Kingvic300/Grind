import { useCallback, useState } from 'react';

const STORAGE_KEY = 'grind.discover.viewed';
/** Oldest ids drop off past this, so storage stays small. */
const MAX_IDS = 2000;

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Discover listings this browser has opened, by listing id. */
export function useViewedListings() {
  const [viewed, setViewed] = useState<Set<string>>(() => new Set(load()));

  const markViewed = useCallback((id: string) => {
    setViewed((prev) => {
      if (prev.has(id)) return prev;
      const ids = [...load().filter((v) => v !== id), id].slice(-MAX_IDS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      } catch {
        // Private mode or full storage: still mark it for this visit.
      }
      return new Set([...prev, id]);
    });
  }, []);

  return { viewed, markViewed };
}
