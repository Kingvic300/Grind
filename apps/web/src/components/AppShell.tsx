import { useEffect, useState } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { useLiveUpdates, useMe, useSpaces } from '../lib/hooks';
import { SpaceProvider, useSpaceId } from '../lib/space';
import type { Hackathon } from '../lib/types';
import { HackathonDrawer } from './HackathonDrawer';
import { IconBoard, IconCalendar, IconCompass, IconList, IconOverview, IconPlus, IconSettings, IconUsers } from './Icons';
import { Logo } from './Logo';

type Editing = { hackathon: Hackathon | null } | null;
type ShellContext = { openEditor: (hackathon?: Hackathon) => void };

/** Lets any app page open the add or edit drawer. */
export const useShell = () => useOutletContext<ShellContext>();

// short is the label in the phone tab bar, where seven items share the width.
const NAV = [
  { to: '/app', label: 'Overview', short: 'Home', icon: <IconOverview />, end: true },
  { to: '/app/hackathons', label: 'Hackathons', short: 'List', icon: <IconList />, end: false },
  { to: '/app/board', label: 'Board', short: 'Board', icon: <IconBoard />, end: false },
  { to: '/app/calendar', label: 'Calendar', short: 'Calendar', icon: <IconCalendar />, end: false },
  { to: '/app/discover', label: 'Discover', short: 'Discover', icon: <IconCompass />, end: false },
  { to: '/app/sharing', label: 'Sharing', short: 'Share', icon: <IconUsers />, end: false },
  { to: '/app/settings', label: 'Settings', short: 'Settings', icon: <IconSettings />, end: false },
];

/** Picks which list the app shows: the private list or one of the shared lists. */
function SpaceSwitcher({ id }: { id: string }) {
  const { spaceId, setSpaceId } = useSpaceId();
  const spaces = useSpaces();
  return (
    <label className="space-switch" htmlFor={id}>
      <span>Showing</span>
      <select id={id} value={spaceId ?? ''} onChange={(e) => setSpaceId(e.target.value || null)}>
        <option value="">My hackathons (private)</option>
        {spaces.data?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.members.length} {s.members.length === 1 ? 'person' : 'people'})
          </option>
        ))}
      </select>
    </label>
  );
}

function Shell() {
  const me = useMe();
  const spaces = useSpaces();
  const { spaceId, setSpaceId } = useSpaceId();
  const [editing, setEditing] = useState<Editing>(null);
  const openEditor = (hackathon?: Hackathon) => setEditing({ hackathon: hackathon ?? null });
  useLiveUpdates(Boolean(me.data));

  // The remembered list may be gone (left, removed, or deleted). Fall back to the private list.
  useEffect(() => {
    if (spaceId && spaces.data && !spaces.data.some((s) => s.id === spaceId)) {
      setSpaceId(null);
      setEditing(null);
    }
  }, [spaceId, spaces.data, setSpaceId]);

  return (
    <div className="shell">
      <aside className="shell-side">
        <Logo to="/app" size={26} />
        <SpaceSwitcher id="space-switch-side" />
        <button type="button" className="btn btn-accent shell-add" onClick={() => openEditor()}>
          <IconPlus /> Add hackathon
        </button>
        <nav className="shell-nav" aria-label="App">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} aria-label={item.label}>
              {item.icon}
              <span className="nav-long">{item.label}</span>
              <span className="nav-short" aria-hidden="true">{item.short}</span>
            </NavLink>
          ))}
        </nav>
        <div className="shell-user">
          <span className="avatar" aria-hidden="true">{me.data?.name.slice(0, 1).toUpperCase()}</span>
          <span className="shell-user-text">
            <strong>{me.data?.name}</strong>
            <span>{me.data?.email}</span>
          </span>
        </div>
      </aside>

      <main className="shell-main">
        <div className="shell-top">
          <SpaceSwitcher id="space-switch-top" />
        </div>
        <Outlet context={{ openEditor } satisfies ShellContext} />
      </main>

      <button type="button" className="fab" onClick={() => openEditor()} aria-label="Add hackathon">
        <IconPlus />
      </button>

      {editing && (
        <HackathonDrawer
          key={editing.hackathon?.id ?? 'new'}
          hackathon={editing.hackathon}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

export function AppShell() {
  return (
    <SpaceProvider>
      <Shell />
    </SpaceProvider>
  );
}

/** Page title row used at the top of every app page. */
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </header>
  );
}

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty">
      <div className="empty-prompt" aria-hidden="true">
        <span>&gt;</span> grind add<i />
      </div>
      <h2>No hackathons yet</h2>
      <p>Add the first one you have your eye on. A name is enough to start.</p>
      <button type="button" className="btn btn-accent" onClick={onAdd}>
        <IconPlus /> Add hackathon
      </button>
    </div>
  );
}
