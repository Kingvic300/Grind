import { useState } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { useMe } from '../lib/hooks';
import type { Hackathon } from '../lib/types';
import { HackathonDrawer } from './HackathonDrawer';
import { IconBoard, IconCalendar, IconList, IconOverview, IconPlus, IconSettings } from './Icons';
import { Logo } from './Logo';

type Editing = { hackathon: Hackathon | null } | null;
type ShellContext = { openEditor: (hackathon?: Hackathon) => void };

/** Lets any app page open the add or edit drawer. */
export const useShell = () => useOutletContext<ShellContext>();

const NAV = [
  { to: '/app', label: 'Overview', icon: <IconOverview />, end: true },
  { to: '/app/hackathons', label: 'Hackathons', icon: <IconList />, end: false },
  { to: '/app/board', label: 'Board', icon: <IconBoard />, end: false },
  { to: '/app/calendar', label: 'Calendar', icon: <IconCalendar />, end: false },
  { to: '/app/settings', label: 'Settings', icon: <IconSettings />, end: false },
];

export function AppShell() {
  const me = useMe();
  const [editing, setEditing] = useState<Editing>(null);
  const openEditor = (hackathon?: Hackathon) => setEditing({ hackathon: hackathon ?? null });

  return (
    <div className="shell">
      <aside className="shell-side">
        <Logo to="/app" size={26} />
        <button type="button" className="btn btn-accent shell-add" onClick={() => openEditor()}>
          <IconPlus /> Add hackathon
        </button>
        <nav className="shell-nav" aria-label="App">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.icon}
              <span>{item.label}</span>
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
