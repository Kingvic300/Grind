import { type FormEvent, useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { IconLink } from '../../components/Icons';
import { useMe, useSpaceActions, useSpaces } from '../../lib/hooks';
import { useSpaceId } from '../../lib/space';
import type { Space } from '../../lib/types';

const inviteUrl = (code: string) => `${window.location.origin}/join/${code}`;

function SpacePanel({ space, myId }: { space: Space; myId: string }) {
  const actions = useSpaceActions();
  const { spaceId, setSpaceId } = useSpaceId();
  const [name, setName] = useState(space.name);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = space.role === 'OWNER';
  const link = inviteUrl(space.inviteCode);

  const run = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      if (done) setMessage({ ok: true, text: done });
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const copy = () =>
    run(async () => {
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        throw new Error('Copy did not work here. Select the link and copy it by hand.');
      }
    }, 'Invite link copied. Send it to your friends.');

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    void run(() => actions.rename(space.id, name.trim()), 'Name saved');
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
        <button type="button" className="btn btn-outline" onClick={() => setSpaceId(space.id)} disabled={spaceId === space.id}>
          {spaceId === space.id ? 'Showing now' : 'Show this list'}
        </button>
      </header>

      <div className="field">
        <span>Invite link</span>
        <div className="invite-row">
          <input value={link} readOnly aria-label={`Invite link for ${space.name}`} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn-ink" onClick={copy} disabled={busy}>
            <IconLink /> Copy
          </button>
        </div>
        <small>Anyone with this link can join after they log in, then add and edit hackathons in this list.</small>
      </div>

      <div className="members">
        <h3>Members</h3>
        <ul>
          {space.members.map((m) => (
            <li key={m.id}>
              <span className="avatar" aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}</span>
              <span className="member-text">
                <strong>{m.name}{m.id === myId ? ' (you)' : ''}</strong>
                <span>{m.email}</span>
              </span>
              {m.role === 'OWNER' && <span className="tag">Owner</span>}
              {owner && m.id !== myId && (
                <button
                  type="button"
                  className="btn btn-quiet btn-danger-text"
                  disabled={busy}
                  onClick={() => run(() => actions.removeMember(space.id, m.id), `${m.name} removed`)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <form className="rename-row" onSubmit={saveName}>
        <label className="field" htmlFor={`space-name-${space.id}`}>
          <span>List name</span>
          <input id={`space-name-${space.id}`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </label>
        <button type="submit" className="btn btn-outline" disabled={busy || !name.trim() || name.trim() === space.name}>Save name</button>
      </form>

      {message && <p className={message.ok ? 'form-ok' : 'form-error'} role="status">{message.text}</p>}

      <div className="space-actions">
        {owner && (
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => run(() => actions.resetInvite(space.id), 'New invite link made. The old link no longer works.')}>
            Make new invite link
          </button>
        )}
        <span className="spacer" />
        {confirm ? (
          <span className="confirm">
            {confirm === 'delete'
              ? 'Delete this list and all its hackathons for everyone?'
              : space.members.length === 1
                ? 'You are the last member. Leaving deletes the list and its hackathons.'
                : 'Leave this list? You lose access until someone invites you again.'}
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => run(() => (confirm === 'delete' ? actions.remove(space.id) : actions.removeMember(space.id, myId)))}
            >
              {confirm === 'delete' ? 'Delete' : 'Leave'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirm(null)}>Keep</button>
          </span>
        ) : (
          <>
            <button type="button" className="btn btn-quiet btn-danger-text" onClick={() => setConfirm('leave')}>Leave list</button>
            {owner && <button type="button" className="btn btn-quiet btn-danger-text" onClick={() => setConfirm('delete')}>Delete list</button>}
          </>
        )}
      </div>
    </section>
  );
}

export function SharingPage() {
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

  if (spaces.isPending || !me.data) return <div className="page-loading" role="status">Loading your shared lists</div>;
  if (spaces.isError) return <div className="page-error" role="alert">{spaces.error.message}</div>;

  return (
    <>
      <PageHead title="Sharing" sub="Make a shared list, send the invite link, and everyone in it can add and edit hackathons. Changes show up live." />
      <div className="sharing">
        <form className="panel create-space" onSubmit={create}>
          <h2>New shared list</h2>
          <div className="rename-row">
            <label className="field" htmlFor="new-space-name">
              <span>Name</span>
              <input id="new-space-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Team Floodline 2027" />
            </label>
            <button type="submit" className="btn btn-accent" disabled={busy || !name.trim()}>{busy ? 'Creating' : 'Create list'}</button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="hint">Your private list stays private. Only hackathons you add to a shared list are shared.</p>
        </form>

        {spaces.data.length ? (
          spaces.data.map((space) => <SpacePanel key={space.id} space={space} myId={me.data!.id} />)
        ) : (
          <p className="panel panel-empty">No shared lists yet. Create one above, then copy its invite link.</p>
        )}
      </div>
    </>
  );
}
