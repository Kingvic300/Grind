import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHackathons, useMe, useSpaces } from '../lib/hooks';
import { useSpaceId } from '../lib/space';
import type { Profile } from '../lib/types';
import { Avatar } from './Avatar';
import { IconCheck, IconChevronDown, IconLock, IconPlus } from './Icons';

export function Faces({ people, max = 3, size = 20 }: { people: Profile[]; max?: number; size?: number }) {
  return (
    <span className="faces" aria-hidden="true">
      {people.slice(0, max).map((p) => <Avatar key={p.id} person={p} size={size} className="face" />)}
      {people.length > max && <span className="face face-more" style={{ width: size, height: size }}>+{people.length - max}</span>}
    </span>
  );
}

/** Picks which list the app shows: the private list or one of the shared lists. */
export function SpaceSwitcher({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { spaceId, setSpaceId } = useSpaceId();
  const spaces = useSpaces();
  const me = useMe();
  const hackathons = useHackathons();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on a click outside or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = spaces.data?.find((s) => s.id === spaceId) ?? null;
  const count = hackathons.data?.length;
  const countText = count === undefined ? '' : ` · ${count} ${count === 1 ? 'hackathon' : 'hackathons'}`;

  const choose = (id: string | null) => {
    setSpaceId(id);
    setOpen(false);
  };

  return (
    <div className={`switcher switcher-${tone}`} ref={root}>
      <button
        type="button"
        className="switcher-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="switcher-label">Showing</span>
        <span className="switcher-main">
          <span className="switcher-name">{current ? current.name : 'My hackathons'}</span>
          <IconChevronDown />
        </span>
        <span className="switcher-sub">
          {current ? (
            <>
              <Faces people={current.members} />
              {current.members.length} people{countText}
            </>
          ) : (
            <>
              <IconLock /> Private{countText}
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="switcher-menu" id={menuId}>
          <button type="button" className={!spaceId ? 'is-on' : ''} aria-current={!spaceId} onClick={() => choose(null)}>
            <Avatar person={me.data} size={28} className="face face-solo" />
            <span className="switcher-option">
              <strong>My hackathons</strong>
              <span>Only you</span>
            </span>
            {!spaceId && <IconCheck />}
          </button>
          {spaces.data?.map((s) => (
            <button type="button" key={s.id} className={spaceId === s.id ? 'is-on' : ''} aria-current={spaceId === s.id} onClick={() => choose(s.id)}>
              <Faces people={s.members} max={2} />
              <span className="switcher-option">
                <strong>{s.name}</strong>
                <span>{s.members.length} people · {s.hackathonCount} {s.hackathonCount === 1 ? 'hackathon' : 'hackathons'}</span>
              </span>
              {spaceId === s.id && <IconCheck />}
            </button>
          ))}
          <Link to="/app/sharing" className="switcher-new" onClick={() => setOpen(false)}>
            <IconPlus /> New shared list
          </Link>
        </div>
      )}
    </div>
  );
}
