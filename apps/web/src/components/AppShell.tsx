import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuthActions, useHackathons, useLiveUpdates, useMe, useSpaces } from '../lib/hooks';
import { SpaceProvider, useSpaceId } from '../lib/space';
import type { Hackathon } from '../lib/types';
import { setClockPreference } from '../lib/time';
import { Avatar } from './Avatar';
import { HackathonDrawer } from './HackathonDrawer';
import { IconBoard, IconCalendar, IconCompass, IconList, IconLogout, IconOverview, IconPlus, IconSettings, IconUsers } from './Icons';
import { Logo } from './Logo';
import { NextUp } from './NextUp';
import { SpaceSwitcher } from './SpaceSwitcher';

type Editing = { hackathon: Hackathon | null } | null;
type ShellContext = { openEditor: (hackathon?: Hackathon) => void };

/** Lets any app page open the add or edit drawer. */
export const useShell = () => useOutletContext<ShellContext>();

type NavItem = { to: string; label: string; short: string; icon: React.ReactNode; end?: boolean; count?: boolean; phoneOnly?: boolean };

// short is the label in the phone tab bar, where seven items share the width.
const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Track',
    items: [
      { to: '/app', label: 'Overview', short: 'Home', icon: <IconOverview />, end: true },
      { to: '/app/hackathons', label: 'Hackathons', short: 'List', icon: <IconList />, count: true },
      { to: '/app/board', label: 'Board', short: 'Board', icon: <IconBoard /> },
      { to: '/app/calendar', label: 'Calendar', short: 'Calendar', icon: <IconCalendar /> },
    ],
  },
  {
    title: 'Explore',
    items: [
      { to: '/app/discover', label: 'Discover', short: 'Discover', icon: <IconCompass /> },
      { to: '/app/team', label: 'Team', short: 'Team', icon: <IconUsers /> },
      // On wide screens Settings lives in the account row instead.
      { to: '/app/settings', label: 'Settings', short: 'Settings', icon: <IconSettings />, phoneOnly: true },
    ],
  },
];

function Shell() {
  const me = useMe();
  const spaces = useSpaces();
  const hackathons = useHackathons();
  const actions = useAuthActions();
  const navigate = useNavigate();
  const { spaceId, setSpaceId } = useSpaceId();
  const [editing, setEditing] = useState<Editing>(null);
  const openEditor = (hackathon?: Hackathon) => setEditing({ hackathon: hackathon ?? null });
  useLiveUpdates(Boolean(me.data));
  if (me.data) setClockPreference(me.data.timeFormat);

  // Open the user's default list once per visit, when they picked one in Settings.
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (appliedDefault.current || !me.data) return;
    appliedDefault.current = true;
    // null means "remember the last list I used", which SpaceProvider already does.
    const preferred = me.data.defaultSpaceId;
    if (preferred) setSpaceId(preferred === 'private' ? null : preferred);
  }, [me.data, setSpaceId]);

  // The remembered list may be gone (left, removed, or deleted). Fall back to the private list.
  useEffect(() => {
    if (spaceId && spaces.data && !spaces.data.some((s) => s.id === spaceId)) {
      setSpaceId(null);
      setEditing(null);
    }
  }, [spaceId, spaces.data, setSpaceId]);

  const logout = async () => {
    await actions.logout();
    navigate('/');
  };

  return (
    <div className="shell">
      <aside className="shell-side">
        <Logo to="/app" size={26} onDark />
        <SpaceSwitcher />
        <button type="button" className="btn btn-accent shell-add" onClick={() => openEditor()}>
          <IconPlus /> Add hackathon
        </button>

        <nav className="shell-nav" aria-label="App">
          {GROUPS.map((group) => (
            <div className="nav-group" key={group.title}>
              <p className="nav-title">{group.title}</p>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} aria-label={item.label} className={item.phoneOnly ? 'phone-only' : undefined}>
                  {item.icon}
                  <span className="nav-long">{item.label}</span>
                  <span className="nav-short" aria-hidden="true">{item.short}</span>
                  {item.count && hackathons.data && <span className="nav-count">{hackathons.data.length}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <NextUp onOpen={openEditor} />

        <div className="shell-user">
          <Avatar person={me.data} />
          <span className="shell-user-text">
            <strong>{me.data?.name}</strong>
            <span>{me.data?.email}</span>
          </span>
          <Link to="/app/settings" className="side-icon" aria-label="Settings" title="Settings"><IconSettings /></Link>
          <button type="button" className="side-icon" onClick={logout} aria-label="Log out" title="Log out"><IconLogout /></button>
        </div>
      </aside>

      <main className="shell-main">
        <div className="shell-top">
          <SpaceSwitcher tone="light" />
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
export function PageHead({ title, sub, children }: { title: React.ReactNode; sub?: string; children?: React.ReactNode }) {
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
