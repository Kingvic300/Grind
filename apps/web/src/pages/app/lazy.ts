import { lazy, type ComponentType } from 'react';

/**
 * App pages load as separate chunks, so the landing page and login do not download the whole
 * app. Once the app is open, preloadAppPages fetches every chunk in the background, so moving
 * between pages never waits on a download.
 */
const loaders = {
  overview: () => import('./Overview').then((m) => ({ default: m.OverviewPage })),
  list: () => import('./List').then((m) => ({ default: m.ListPage })),
  board: () => import('./Board').then((m) => ({ default: m.BoardPage })),
  calendar: () => import('./Calendar').then((m) => ({ default: m.CalendarPage })),
  goals: () => import('./Goals').then((m) => ({ default: m.GoalsPage })),
  notes: () => import('./Notes').then((m) => ({ default: m.NotesPage })),
  discover: () => import('./Discover').then((m) => ({ default: m.DiscoverPage })),
  listing: () => import('./ListingDetail').then((m) => ({ default: m.ListingDetailPage })),
  team: () => import('./Team').then((m) => ({ default: m.TeamPage })),
  settings: () => import('./Settings').then((m) => ({ default: m.SettingsPage })),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>;

type Name = keyof typeof loaders;

export const Pages = Object.fromEntries(Object.entries(loaders).map(([name, load]) => [name, lazy(load)])) as unknown as Record<Name, ComponentType>;

let preloaded = false;
export function preloadAppPages() {
  if (preloaded) return;
  preloaded = true;
  for (const load of Object.values(loaders)) void load().catch(() => undefined);
}
