import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'grind.space';

/** Saves which list to open next. Storage can be blocked, so failures are ignored. */
export function rememberSpace(spaceId: string | null) {
  try {
    if (spaceId) localStorage.setItem(STORAGE_KEY, spaceId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the choice just does not persist.
  }
}

function storedSpace(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

type SpaceContextValue = { spaceId: string | null; setSpaceId: (id: string | null) => void };

const SpaceContext = createContext<SpaceContextValue>({ spaceId: null, setSpaceId: () => {} });

/** Holds the list the app is showing: null for the private list, or a shared list id. */
export function SpaceProvider({ children }: { children: ReactNode }) {
  const [spaceId, setSpaceId] = useState<string | null>(storedSpace);
  useEffect(() => rememberSpace(spaceId), [spaceId]);
  return <SpaceContext.Provider value={{ spaceId, setSpaceId }}>{children}</SpaceContext.Provider>;
}

export const useSpaceId = () => useContext(SpaceContext);
