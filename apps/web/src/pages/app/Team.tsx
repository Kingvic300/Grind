import { type FormEvent, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead, useShell } from '../../components/AppShell';
import { Avatar } from '../../components/Avatar';
import { IconLink } from '../../components/Icons';
import { Bone, PanelsSkeleton, Spinner } from '../../components/Loading';
import { fetchOlderActivity, useActivity, useHackathons, useMe, useSpaceActions, useSpaces } from '../../lib/hooks';
import { useSpaceId } from '../../lib/space';
import { timeAgo } from '../../lib/time';
import type { Activity, Space } from '../../lib/types';

const inviteUrl = (code: string) => `${window.location.origin}/join/${code}`;

/** One line of the feed, e.g. "Ben moved Kiroween to Building". */
function describe(a: Activity, name: (fallback: string | null) => ReactNode): ReactNode {
  const h = name(a.hackathonName);
  switch (a.kind) {
    case 'added': return <>added {h}</>;
    case 'moved': return <>moved {h} to <b>{a.detail}</b></>;
    case 'edited': return <>edited {h}</>;
    case 'deleted': return <>deleted <b>{a.detail}</b></>;
    case 'assigned': return <>assigned <b>{a.detail}</b> to {h}</>;
    case 'task_added': return <>added a task to {h}</>;
    case 'task_done': return <>finished a task on {h}</>;
    case 'commented': return <>commented on {h}</>;
    case 'joined': return <>joined the team</>;
    case 'left': return a.detail ? <>removed <b>{a.detail}</b> from the team</> : <>left the team</>;
    case 'renamed': return <>renamed the team to <b>{a.detail}</b></>;
    default: return null;
  }
}

/** Kinds whose detail is a quote worth showing under the line. */
const QUOTED = new Set(['task_added', 'task_done', 'commented']);

function ActivityFeed({ space }: { space: Space }) {
  const feed = useActivity(space.id);
  const { spaceId } = useSpaceId();
  const { openEditor } = useShell();
  const hackathons = useHackathons();
  const [older, setOlder] = useState<Activity[]>([]);
  const [end, setEnd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (feed.isPending) {
    return (
      <div className="feed" aria-busy="true" aria-label="Loading activity">
        {[0, 1, 2, 3].map((i) => <div className="feed-item" key={i}><Bone style={{ width: 28, height: 28, borderRadius: 8 }} /><Bone style={{ width: '70%', height: 14 }} /></div>)}
      </div>
    );
  }
  if (feed.isError) return <p className="form-error" role="alert">{feed.error.message}</p>;

  // Entries can repeat when new ones arrive while older pages are loaded.
  const seen = new Set<string>();
  const items = [...feed.data, ...older].filter((a) => !seen.has(a.id) && seen.add(a.id));

  const more = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoading(true);
    setError('');
    try {
      const page = await fetchOlderActivity(space.id, last.createdAt);
      setOlder((o) => [...o, ...page]);
      if (page.length < 30) setEnd(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Hackathon names open the drawer when this team is the list on screen.
  const name = (a: Activity) => (fallback: string | null) => {
    const target = spaceId === space.id ? hackathons.data?.find((h) => h.id === a.hackathonId) : undefined;
    const label = target?.name ?? fallback ?? 'a hackathon';
    return target ? <button type="button" className="feed-link" onClick={() => openEditor(target)}>{label}</button> : <b>{label}</b>;
  };

  if (!items.length) return <p className="muted feed-empty">Nothing yet. Adds, moves, tasks and comments show up here.</p>;

  return (
    <div className="feed">
      <ul>
        {items.map((a) => (
          <li className="feed-item" key={a.id}>
            <Avatar person={a.actor} size={28} />
            <div className="feed-text">
              <p><strong>{a.actor?.name ?? 'Someone'}</strong> {describe(a, name(a))}</p>
              {QUOTED.has(a.kind) && a.detail && <q>{a.detail}</q>}
              <time dateTime={a.createdAt}>{timeAgo(a.createdAt)}</time>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!end && items.length >= 30 && (
        <button type="button" className="btn btn-quiet" onClick={more} disabled={loading}>{loading && <Spinner />}Show older</button>
      )}
    </div>
  );
}

function SpacePanel({ space, myId }: { space: Space; myId: string }) {
  const actions = useSpaceActions();
  const navigate = useNavigate();
  const { setSpaceId } = useSpaceId();
  const [name, setName] = useState(space.name);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  // Which action is running, so only that button shows a spinner.
  const [working, setWorking] = useState<string | null>(null);
  const busy = working !== null;
  const spin = (key: string) => (working === key ? <Spinner /> : null);
  const owner = space.role === 'OWNER';
  const link = inviteUrl(space.inviteCode);

  const run = async (key: string, work: () => Promise<unknown>, done?: string) => {
    setWorking(key);
    setMessage(null);
    try {
      await work();
      if (done) setMessage({ ok: true, text: done });
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message });
    } finally {
      setWorking(null);
    }
  };

  const copy = () =>
    run('copy', async () => {
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        throw new Error('Copy did not work here. Select the link and copy it by hand.');
      }
    }, 'Invite link copied. Send it to your teammates.');

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    void run('rename', () => actions.rename(space.id, name.trim()), 'Name saved');
  };

  return (
    <section className="panel space-panel">
      <header className="space-panel-head">
        <div>
          <h2>{space.name}</h2>
          <p className="muted">
            {space.hackathonCount} {space.hackathonCount === 1 ? 'hackathon' : 'hackathons'}, {space.members.length}{' '}
            {space.members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        <button type="button" className="btn btn-ink" onClick={() => { setSpaceId(space.id); navigate('/app/board'); }}>
          Open team board
        </button>
      </header>

      <div className="team-grid">
      <div className="team-main">

      <div className="field">
        <span>Invite link</span>
        <div className="invite-row">
          <input value={link} readOnly aria-label={`Invite link for ${space.name}`} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn-ink" onClick={copy} disabled={busy}>
            {working === 'copy' ? <Spinner /> : <IconLink />} Copy
          </button>
        </div>
        <small>Anyone with this link can join after they log in. Everyone in the team can add, move and edit hackathons, tasks and comments.</small>
      </div>

      <div className="members">
        <h3>Members</h3>
        <ul>
          {space.members.map((m) => (
            <li key={m.id}>
              <Avatar person={m} size={38} />
              <span className="member-text">
                <strong>{m.name}{m.id === myId ? ' (you)' : ''}</strong>
                <span>{m.bio || m.email}</span>
                {(m.skills?.length || m.githubUrl || m.linkedinUrl || m.websiteUrl || m.xUrl) && (
                  <span className="member-extra">
                    {m.skills?.slice(0, 4).map((s) => <span key={s} className="chip">{s}</span>)}
                    {[['GitHub', m.githubUrl], ['LinkedIn', m.linkedinUrl], ['Website', m.websiteUrl], ['X', m.xUrl]]
                      .filter(([, href]) => href)
                      .map(([label, href]) => <a key={label} href={href as string} target="_blank" rel="noopener noreferrer">{label}</a>)}
                  </span>
                )}
              </span>
              {m.role === 'OWNER' && <span className="tag">Owner</span>}
              {owner && m.id !== myId && (
                <button
                  type="button"
                  className="btn btn-quiet btn-danger-text"
                  disabled={busy}
                  onClick={() => run(`remove-${m.id}`, () => actions.removeMember(space.id, m.id), `${m.name} removed`)}
                >
                  {spin(`remove-${m.id}`)}Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {owner && (
        <form className="rename-row" onSubmit={saveName}>
          <label className="field" htmlFor={`space-name-${space.id}`}>
            <span>Team name</span>
            <input id={`space-name-${space.id}`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
          </label>
          <button type="submit" className="btn btn-outline" disabled={busy || !name.trim() || name.trim() === space.name}>{spin('rename')}Save name</button>
        </form>
      )}

      {message && <p className={message.ok ? 'form-ok' : 'form-error'} role="status">{message.text}</p>}

      <div className="space-actions">
        {owner && (
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => run('reset', () => actions.resetInvite(space.id), 'New invite link made. The old link no longer works.')}>
            {spin('reset')}Make new invite link
          </button>
        )}
        <span className="spacer" />
        {confirm ? (
          <span className="confirm">
            {confirm === 'delete'
              ? 'Delete this team and all its hackathons for everyone?'
              : space.members.length === 1
                ? 'You are the last member. Leaving deletes the team and its hackathons.'
                : 'Leave this team? You lose access until someone invites you again.'}
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => run('confirm', () => (confirm === 'delete' ? actions.remove(space.id) : actions.removeMember(space.id, myId)))}
            >
              {spin('confirm')}{confirm === 'delete' ? 'Delete' : 'Leave'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirm(null)}>Keep</button>
          </span>
        ) : (
          <>
            <button type="button" className="btn btn-quiet btn-danger-text" onClick={() => setConfirm('leave')}>Leave team</button>
            {owner && <button type="button" className="btn btn-quiet btn-danger-text" onClick={() => setConfirm('delete')}>Delete team</button>}
          </>
        )}
      </div>
      </div>

      <aside className="team-activity" aria-label={`${space.name} activity`}>
        <h3>Activity</h3>
        <ActivityFeed space={space} />
      </aside>
      </div>
    </section>
  );
}

export function TeamPage() {
  const me = useMe();
  const spaces = useSpaces();
  const actions = useSpaceActions();
  const { setSpaceId } = useSpaceId();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const space = await actions.create(name.trim());
      setName('');
      setSpaceId(space.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (spaces.isPending || !me.data) return <PanelsSkeleton label="Loading your teams" />;
  if (spaces.isError) return <div className="page-error" role="alert">{spaces.error.message}</div>;

  return (
    <>
      <PageHead title="Team" sub="Make a team, send the invite link, and everyone in it shares one board: add hackathons, assign people, split tasks and comment. Changes show up live." />
      <div className="sharing">
        <form className="panel create-space" onSubmit={create}>
          <h2>New team</h2>
          <div className="rename-row">
            <label className="field" htmlFor="new-space-name">
              <span>Name</span>
              <input id="new-space-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Team Floodline 2027" />
            </label>
            <button type="submit" className="btn btn-accent" disabled={busy || !name.trim()}>{busy && <Spinner />}{busy ? 'Creating' : 'Create team'}</button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="hint">Your private list stays private. Only hackathons you add to a team are shared with it.</p>
        </form>

        {spaces.data.length ? (
          spaces.data.map((space) => <SpacePanel key={space.id} space={space} myId={me.data!.id} />)
        ) : (
          <p className="panel panel-empty">No teams yet. Create one above, then copy its invite link.</p>
        )}
      </div>
    </>
  );
}
