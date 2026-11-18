import { useEffect, useState } from 'react';

/** Values kept for this tab while the app is open. A reload starts fresh. */
const memory = new Map<string, unknown>();

/**
 * useState that survives leaving the page and coming back, such as Discover filters
 * kept while someone reads a listing's details page.
 */
export function useRemembered<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial));
  useEffect(() => {
    memory.set(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

/** Last scroll position of a page, read back when the page opens again. */
export const scrollMemory = {
  save: (key: string) => memory.set(`scroll:${key}`, window.scrollY),
  take: (key: string) => {
    const y = memory.get(`scroll:${key}`);
    memory.delete(`scroll:${key}`);
    return typeof y === 'number' ? y : null;
  },
};
