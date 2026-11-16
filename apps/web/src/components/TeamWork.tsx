import { type KeyboardEvent, useState } from 'react';
import { useCommentActions, useComments, useMe, useTaskActions, useTasks } from '../lib/hooks';
import { timeAgo } from '../lib/time';
import type { Profile, SpaceMember } from '../lib/types';
import { Avatar } from './Avatar';
import { IconTrash } from './Icons';
import { Bone, Spinner } from './Loading';

/** Toggle chips for picking who is on a hackathon. */
export function AssigneePicker({ members, value, onChange }: { members: SpaceMember[]; value: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="assignee-picker" role="group" aria-label="Assigned to">
      {members.map((m) => {
        const on = value.includes(m.id);
        return (
          <button type="button" key={m.id} className={on ? 'is-on' : ''} aria-pressed={on} onClick={() => toggle(m.id)}>
            <Avatar person={m} size={22} />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

/** Overlapping faces for a card or row. */
export function Faces({ people, max = 3, size = 22 }: { people: Profile[]; max?: number; size?: number }) {
  if (!people.length) return null;
  const extra = people.length - max;
  return (
    <span className="faces" title={people.map((p) => p.name).join(', ')}>
      {people.slice(0, max).map((p) => <Avatar key={p.id} person={p} size={size} className="face" />)}
      {extra > 0 && <span className="face face-more" style={{ width: size, height: size }}>+{extra}</span>}
      <span className="sr-only">Assigned to {people.map((p) => p.name).join(', ')}</span>
    </span>
  );
}

const rowSkeleton = (n: number) => (
  <div className="tw-list" aria-busy="true">
    {Array.from({ length: n }, (_, i) => <Bone key={i} style={{ height: 40, borderRadius: 10 }} />)}
  </div>
);

export function TasksPanel({ hackathonId, members }: { hackathonId: string; members: SpaceMember[] | null }) {
  const tasks = useTasks(hackathonId);
  const actions = useTaskActions(hackathonId);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = async (key: string, work: () => Promise<unknown>) => {
    setWorking(key);
    setError('');
    try {
      await work();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setWorking(null);
    }
  };

  const add = async () => {
    if (!title.trim() || working) return;
    if (await run('add', () => actions.add({ title: title.trim(), assigneeId: assignee || null }))) setTitle('');
  };
  // The drawer is a form, so Enter here must add the task instead of saving the hackathon.
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void add();
    }
  };

  const list = tasks.data ?? [];
  const done = list.filter((t) => t.done).length;

  return (
    <section className="tw" aria-label="Tasks">
      {list.length > 0 && (
        <div className="tw-progress">
          <span>{done} of {list.length} done</span>
          <span className="tw-bar"><i style={{ width: `${(done / list.length) * 100}%` }} /></span>
        </div>
      )}

      {tasks.isPending ? rowSkeleton(3) : tasks.isError ? (
        <p className="form-error" role="alert">{tasks.error.message}</p>
      ) : (
        <ul className="tw-list">
          {list.map((t) => (
            <li key={t.id} className={`task${t.done ? ' is-done' : ''}`}>
              <label className="task-check">
                <input type="checkbox" checked={t.done} onChange={(e) => void run(t.id, () => actions.update(t.id, { done: e.target.checked }))} />
                <span>{t.title}</span>
              </label>
              {members ? (
                <select
                  className="task-who"
                  aria-label={`Who does "${t.title}"`}
                  value={t.assignee?.id ?? ''}
                  onChange={(e) => void run(t.id, () => actions.update(t.id, { assigneeId: e.target.value || null }))}
                >
                  <option value="">Anyone</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              ) : null}
              {t.assignee && <Avatar person={t.assignee} size={22} />}
              <button type="button" className="icon-btn icon-btn-sm" aria-label={`Delete task "${t.title}"`} disabled={working === t.id} onClick={() => void run(t.id, () => actions.remove(t.id))}>
                {working === t.id ? <Spinner /> : <IconTrash />}
              </button>
            </li>
          ))}
          {!list.length && <li className="muted tw-empty">No tasks yet. Split the work: pitch deck, demo video, submission form.</li>}
        </ul>
      )}

      <div className="task-add">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onKey} maxLength={200} placeholder="Add a task, then press Enter" aria-label="New task" />
        {members && (
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Who does the new task">
            <option value="">Anyone</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <button type="button" className="btn btn-ink" onClick={() => void add()} disabled={!title.trim() || working === 'add'}>
          {working === 'add' && <Spinner />}Add
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

export function CommentsPanel({ hackathonId, isOwner }: { hackathonId: string; isOwner: boolean }) {
  const me = useMe();
  const comments = useComments(hackathonId);
  const actions = useCommentActions(hackathonId);
  const [body, setBody] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = async (key: string, work: () => Promise<unknown>) => {
    setWorking(key);
    setError('');
    try {
      await work();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setWorking(null);
    }
  };

  const post = async () => {
    if (!body.trim() || working) return;
    if (await run('post', () => actions.add(body.trim()))) setBody('');
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void post();
    }
  };

  return (
    <section className="tw" aria-label="Comments">
      {comments.isPending ? rowSkeleton(2) : comments.isError ? (
        <p className="form-error" role="alert">{comments.error.message}</p>
      ) : (
        <ul className="comments">
          {comments.data.map((c) => (
            <li key={c.id}>
              <Avatar person={c.author} size={30} />
              <div>
                <p className="comment-head">
                  <strong>{c.author?.name ?? 'Deleted account'}</strong>
                  <time dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time>
                  {(c.author?.id === me.data?.id || isOwner) && (
                    <button type="button" className="link-btn" disabled={working === c.id} onClick={() => void run(c.id, () => actions.remove(c.id))}>
                      {working === c.id && <Spinner />}Delete
                    </button>
                  )}
                </p>
                <p className="comment-body">{c.body}</p>
              </div>
            </li>
          ))}
          {!comments.data.length && <li className="muted tw-empty">No comments yet. Ask a question or leave an update for the team.</li>}
        </ul>
      )}

      <div className="comment-add">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey} rows={3} maxLength={4000} placeholder="Write a comment" aria-label="New comment" />
        <div className="comment-add-row">
          <span className="hint">Ctrl + Enter to post</span>
          <button type="button" className="btn btn-ink" onClick={() => void post()} disabled={!body.trim() || working === 'post'}>
            {working === 'post' && <Spinner />}Post
          </button>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
