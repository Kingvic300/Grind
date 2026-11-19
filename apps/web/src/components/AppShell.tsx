import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { isDue, useAuthActions, useHackathons, useLiveUpdates, useMe, useNotes, useNow, useSpaces } from '../lib/hooks';
import { SpaceProvider, useSpaceId } from '../lib/space';
import type { Hackathon } from '../lib/types';
import { setClockPreference } from '../lib/time';
import { Avatar } from './Avatar';
import { HackathonDrawer } from './HackathonDrawer';
import { IconBoard, IconCalendar, IconClose, IconCompass, IconList, IconLogout, IconMenu, IconNote, IconOverview, IconPlus, IconSettings, IconTarget, IconUsers } from './Icons';
import { Logo } from './Logo';
import { NextUp } from './NextUp';
import { SpaceSwitcher } from './SpaceSwitcher';

type Editing = { hackathon: Hackathon | null } | null;
type ShellContext = { openEditor: (hackathon?: Hackathon) => void };

/** Lets any app page open the add or edit drawer. */
export const useShell = () => useOutletContext<ShellContext>();

type NavItem = { to: string; label: string; short: string; icon: React.ReactNode; end?: boolean; count?: boolean; due?: boolean; tab?: boolean };

// On phones only the tab items sit in the bottom bar. The rest open from More.
// short is the label in the phone tab bar.
const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Track',
    items: [
      { to: '/app', label: 'Overview', short: 'Home', icon: <IconOverview />, end: true, tab: true },
      { to: '/app/hackathons', label: 'Hackathons', short: 'List', icon: <IconList />, count: true, tab: true },
      { to: '/app/board', label: 'Board', short: 'Board', icon: <IconBoard />, tab: true },
      { to: '/app/calendar', label: 'Calendar', short: 'Calendar', icon: <IconCalendar />, tab: true },
    ],
  },
  {
    title: 'Plan',
    items: [
      { to: '/app/goals', label: 'Goals', short: 'Goals', icon: <IconTarget /> },
      { to: '/app/notes', label: 'Notes', short: 'Notes', icon: <IconNote />, due: true },
    ],
  },
  {
    title: 'Explore',
    items: [
      { to: '/app/discover', label: 'Discover', short: 'Discover', icon: <IconCompass /> },
      { to: '/app/team', label: 'Team', short: 'Team', icon: <IconUsers /> },
    ],
  },
];

// Pages behind the phone More button. On wide screens Settings lives in the account row.
const MORE: NavItem[] = [
  ...GROUPS.flatMap((g) => g.items.filter((i) => !i.tab)),
  { to: '/app/settings', label: 'Settings', short: 'Settings', icon: <IconSettings /> },
];

function Shell() {
  const me = useMe();
  const spaces = useSpaces();
  const hackathons = useHackathons();
  const notes = useNotes();
  const now = useNow(30_000);
  const dueNotes = (notes.data ?? []).filter((n) => isDue(n, now)).length;
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

  // Phone More sheet. It closes when the page changes.
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);
  const onMorePage = MORE.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));

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
                <NavLink key={item.to} to={item.to} end={item.end} aria-label={item.due && dueNotes ? `${item.label}, ${dueNotes} due` : item.label} className={item.tab ? undefined : 'nav-extra'}>
                  {item.icon}
                  <span className="nav-long">{item.label}</span>
                  <span className="nav-short" aria-hidden="true">{item.short}</span>
                  {item.count && hackathons.data && <span className="nav-count">{hackathons.data.length}</span>}
                  {item.due && dueNotes > 0 && (
                    <span className="nav-due" aria-hidden="true" title={`${dueNotes} reminder${dueNotes === 1 ? '' : 's'} due`}>
                      {dueNotes}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
          <button
            type="button"
            className={`nav-more${onMorePage ? ' active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-label={dueNotes ? `More, ${dueNotes} due` : 'More'}
          >
            <IconMenu />
            <span className="nav-short" aria-hidden="true">More</span>
            {dueNotes > 0 && <span className="nav-due" aria-hidden="true">{dueNotes}</span>}
          </button>
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

      {moreOpen && <MoreSheet dueNotes={dueNotes} me={me.data} onLogout={logout} onClose={() => setMoreOpen(false)} />}

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

/** Phone sheet with the pages that do not fit the tab bar, plus the account. */
function MoreSheet({ dueNotes, me, onLogout, onClose }: { dueNotes: number; me: ReturnType<typeof useMe>['data']; onLogout: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // showModal gives a focus trap and Esc-to-close for free.
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="more-sheet" aria-label="More" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}>
      <div className="more-panel">
        <div className="more-head">
          <p className="more-title">More</p>
          <button type="button" className="side-icon" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <nav className="more-grid" aria-label="More pages">
          {MORE.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose} aria-label={item.due && dueNotes ? `${item.label}, ${dueNotes} due` : item.label}>
              {item.icon}
              <span>{item.label}</span>
              {item.due && dueNotes > 0 && <span className="nav-due" aria-hidden="true">{dueNotes}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="shell-user">
          <Avatar person={me} />
          <span className="shell-user-text">
            <strong>{me?.name}</strong>
            <span>{me?.email}</span>
          </span>
          <button type="button" className="side-icon" onClick={onLogout} aria-label="Log out" title="Log out"><IconLogout /></button>
        </div>
      </div>
    </dialog>
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

/** Opens the Add hackathon form. Sits in page headers so adding is always one tap away. */
export function AddButton() {
  const { openEditor } = useShell();
  return (
    <button type="button" className="btn btn-accent" onClick={() => openEditor()}>
      <IconPlus /> Add hackathon
    </button>
  );
}

export function EmptyState({ onAdd, children }: { onAdd: () => void; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-prompt" aria-hidden="true">
        <span>&gt;</span> grind add<i />
      </div>
      <h2>No hackathons yet</h2>
      <p>Add the first one you have your eye on. A name is enough to start.</p>
      <div className="empty-actions">
        <button type="button" className="btn btn-accent" onClick={onAdd}>
          <IconPlus /> Add hackathon
        </button>
        {children}
      </div>
    </div>
  );
}
