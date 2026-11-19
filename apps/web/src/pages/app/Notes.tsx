import { useMemo, useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { IconCheck, IconExternal, IconTrash } from '../../components/Icons';
import { PanelsSkeleton, Spinner } from '../../components/Loading';
import { isDue, useMe, useNoteActions, useNotes, useNow, useSpaces } from '../../lib/hooks';
import { useSpaceId } from '../../lib/space';
import { formatMoment, timeAgo, toLocalInput } from '../../lib/time';
import type { Note } from '../../lib/types';

type Filter = 'all' | 'reminders' | 'done';
type Quick = 'none' | 'hour' | 'evening' | 'morning' | 'week' | 'pick';

const LINK = /^(https?:\/\/|www\.)\S+$/i;

/** A reminder moment for a quick choice, from now. */
function quickTime(q: Quick, now = new Date()): Date | null {
  const d = new Date(now);
  switch (q) {
    case 'hour': return new Date(now.getTime() + 60 * 60 * 1000);
    case 'evening':
      d.setHours(20, 0, 0, 0);
      // Past 8 PM already: tomorrow evening.
      if (d <= now) d.setDate(d.getDate() + 1);
      return d;
    case 'morning':
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    case 'week':
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    default: return null;
  }
}

const QUICK_LABEL: Record<Quick, string> = {
  none: 'No reminder',
  hour: 'In 1 hour',
  evening: 'Tonight 8 PM',
  morning: 'Tomorrow 9 AM',
  week: 'In a week',
  pick: 'Pick a time',
};

/** "in 5 min", "in 3 h", "in 2 days". */
function inTime(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `in ${h} h`;
  return `in ${Math.round(h / 24)} days`;
}

const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '') + new URL(url).pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
};

/** Write a note, paste a link, and pick a reminder. Also edits an existing note. */
function NoteForm({ note, onDone }: { note?: Note; onDone?: () => void }) {
  const actions = useNoteActions();
  const { spaceId } = useSpaceId();
  const spaces = useSpaces();
  const teamName = spaceId ? spaces.data?.find((s) => s.id === spaceId)?.name : undefined;
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [url, setUrl] = useState(note?.url ?? '');
  const [quick, setQuick] = useState<Quick>(note?.remindAt ? 'pick' : 'none');
  const [at, setAt] = useState(toLocalInput(note?.remindAt ?? null));
  const [team, setTeam] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pickQuick = (q: Quick) => {
    setQuick(q);
    const time = quickTime(q);
    if (time) setAt(toLocalInput(time.toISOString()));
    else if (q === 'none') setAt('');
  };

  // A link pasted into an empty note goes to the link field.
  const paste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text').trim();
    if (!body.trim() && !url && LINK.test(text)) {
      e.preventDefault();
      setUrl(text);
    }
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!title.trim() && !body.trim() && !url.trim()) return setError('Write something or paste a link.');
    const remindAt = quick === 'none' || !at ? null : new Date(at).toISOString();
    if (remindAt && !note && new Date(remindAt).getTime() < Date.now()) return setError('Pick a reminder time in the future.');
    const input = { title: title.trim() || null, body: body.trim() || null, url: url.trim() || null, remindAt };
    setSaving(true);
    try {
      if (note) await actions.update(note.id, input);
      else await actions.create({ ...input, spaceId: team && spaceId ? spaceId : null });
      if (!note) {
        setTitle('');
        setBody('');
        setUrl('');
        pickQuick('none');
      }
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={note ? 'note-form note-form-edit' : 'panel note-form'} onSubmit={submit}>
      <label className="field">
        <span className="sr-only">Title</span>
        <input
          className="note-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && void submit()}
          maxLength={200}
          placeholder="Title"
          autoFocus={Boolean(note)}
        />
      </label>
      <label className="field">
        <span className="sr-only">Note</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={paste}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && void submit()}
          rows={note ? 3 : 2}
          maxLength={4000}
          placeholder="Write a note. Paste a link here and it goes in the link box."
        />
      </label>
      <label className="field">
        <span className="sr-only">Link</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" inputMode="url" maxLength={1000} placeholder="Link (optional)" />
      </label>

      <div className="note-remind">
        <div className="filter-chips" role="group" aria-label="Reminder">
          {(Object.keys(QUICK_LABEL) as Quick[]).map((q) => (
            <button key={q} type="button" className={quick === q ? 'is-on' : ''} aria-pressed={quick === q} onClick={() => pickQuick(q)}>
              {QUICK_LABEL[q]}
            </button>
          ))}
        </div>
        {quick !== 'none' && (
          <label className="field note-at">
            <span className="sr-only">Remind me at</span>
            <input type="datetime-local" value={at} onChange={(e) => { setAt(e.target.value); setQuick('pick'); }} required />
          </label>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="note-form-foot">
        {!note && teamName && (
          <div className="segmented" role="group" aria-label="Who sees this note">
            <button type="button" className={!team ? 'is-on' : undefined} aria-pressed={!team} onClick={() => setTeam(false)}>Just me</button>
            <button type="button" className={team ? 'is-on' : undefined} aria-pressed={team} onClick={() => setTeam(true)}>{teamName}</button>
          </div>
        )}
        <span className="spacer" />
        {note && <button type="button" className="btn btn-quiet" onClick={onDone} disabled={saving}>Cancel</button>}
        <button type="submit" className="btn btn-accent" disabled={saving}>
          {saving && <Spinner />} {note ? 'Save' : 'Add note'}
        </button>
      </div>
    </form>
  );
}

function NoteCard({ note, now, mine, teamName }: { note: Note; now: number; mine: boolean; teamName?: string }) {
  const actions = useNoteActions();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const due = isDue(note, now);

  const run = async (job: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await job();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <article className="note is-editing">
        <NoteForm note={note} onDone={() => setEditing(false)} />
      </article>
    );
  }

  const until = note.remindAt ? new Date(note.remindAt).getTime() - now : 0;
  return (
    <article className={`note${due ? ' is-due' : ''}${note.done ? ' is-done' : ''}`}>
      <button
        type="button"
        className={`goal-tick${note.done ? ' is-on' : ''}`}
        onClick={() => run(() => actions.update(note.id, { done: !note.done }))}
        aria-pressed={note.done}
        aria-label={note.done ? 'Mark as not done' : 'Mark as done'}
      >
        {note.done && <IconCheck />}
      </button>
      <div className="note-main">
        {due && <p className="note-due">Reminder due</p>}
        {note.title && <h3 className="note-title">{note.title}</h3>}
        {note.body && <p className="note-body">{note.body}</p>}
        {note.url && (
          <a className="note-link" href={note.url} target="_blank" rel="noopener noreferrer">
            <span>{host(note.url)}</span> <IconExternal />
          </a>
        )}
        <p className="note-meta">
          {note.remindAt && (
            <span className={`tag${due ? ' tag-deadline' : ''}`}>
              {until > 0 && !note.done ? `Reminds ${inTime(until)} · ${formatMoment(note.remindAt)}` : `Reminder ${formatMoment(note.remindAt)}`}
            </span>
          )}
          {note.spaceId && <span className="tag">{teamName ?? 'Team'}</span>}
          <span>{!mine && `${note.user.name} · `}{timeAgo(note.createdAt, now)}</span>
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="note-actions">
        {confirm ? (
          <span className="confirm">
            Delete?
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(() => actions.remove(note.id))}>
              {busy && <Spinner />} Delete
            </button>
            <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={() => setConfirm(false)}>Keep</button>
          </span>
        ) : (
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => setConfirm(true)} aria-label="Delete note" title="Delete note">
              <IconTrash />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function NotesPage() {
  const query = useNotes();
  const me = useMe();
  const spaces = useSpaces();
  const { spaceId } = useSpaceId();
  const now = useNow(15_000);
  const [filter, setFilter] = useState<Filter>('all');
  const teamName = spaceId ? spaces.data?.find((s) => s.id === spaceId)?.name : undefined;

  const notes = useMemo(() => query.data ?? [], [query.data]);
  const due = notes.filter((n) => isDue(n, now));
  const shown = useMemo(() => {
    const rest = notes.filter((n) => !isDue(n, now));
    if (filter === 'done') return rest.filter((n) => n.done);
    const open = rest.filter((n) => !n.done);
    if (filter === 'reminders') return open.filter((n) => n.remindAt).sort((a, b) => a.remindAt!.localeCompare(b.remindAt!));
    return open;
  }, [notes, now, filter]);

  if (query.isPending) return <PanelsSkeleton label="Loading your notes" />;
  if (query.isError) return <div className="page-error" role="alert">{query.error.message}</div>;

  const counts = {
    all: notes.filter((n) => !n.done && !isDue(n, now)).length,
    reminders: notes.filter((n) => !n.done && n.remindAt && !isDue(n, now)).length,
    done: notes.filter((n) => n.done).length,
  };

  return (
    <>
      <PageHead title="Notes" sub="Jot things down, save links, and get a reminder when it matters." />

      <NoteForm />

      {due.length > 0 && (
        <section className="note-due-list" aria-label="Reminders due">
          <h2>Due now <b>{due.length}</b></h2>
          {due.map((n) => <NoteCard key={n.id} note={n} now={now} mine={n.userId === me.data?.id} teamName={teamName} />)}
        </section>
      )}

      <div className="note-filter">
        <div className="segmented" role="group" aria-label="Show">
          {(['all', 'reminders', 'done'] as const).map((f) => (
            <button key={f} type="button" className={filter === f ? 'is-on' : undefined} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Open' : f === 'reminders' ? 'With reminder' : 'Done'} <b>{counts[f]}</b>
            </button>
          ))}
        </div>
      </div>

      {shown.length ? (
        <div className="note-list">
          {shown.map((n) => <NoteCard key={n.id} note={n} now={now} mine={n.userId === me.data?.id} teamName={teamName} />)}
        </div>
      ) : (
        <p className="panel-empty note-empty">
          {filter === 'done' ? 'Notes you tick off show up here.' : filter === 'reminders' ? 'No upcoming reminders.' : notes.length ? 'Nothing open. Nice.' : 'No notes yet. Write one above.'}
        </p>
      )}
    </>
  );
}
