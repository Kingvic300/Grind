import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useDeleteHackathon, useHackathons, useSaveHackathon, useSpaces } from '../lib/hooks';
import { dateKey, toLocalInput } from '../lib/time';
import { FORMATS, FORMAT_LABEL, STATUSES, STATUS_LABEL, type Format, type Hackathon, type HackathonInput, type Status } from '../lib/types';
import { IconClose } from './Icons';
import { Spinner } from './Loading';
import { AssigneePicker, CommentsPanel, TasksPanel } from './TeamWork';

type Tab = 'details' | 'tasks' | 'comments';

type FormState = {
  name: string; organizer: string; url: string; format: Format; location: string;
  startDate: string; endDate: string; status: Status;
  registrationDeadline: string; submissionDeadline: string;
  projectName: string; projectDescription: string; techStack: string; teammates: string;
  repoUrl: string; demoUrl: string;
  won: boolean; placement: string; prizeName: string; prizeAmount: string; notes: string;
  assigneeIds: string[];
};

function toForm(h: Hackathon | null): FormState {
  return {
    name: h?.name ?? '', organizer: h?.organizer ?? '', url: h?.url ?? '',
    format: h?.format ?? 'ONLINE', location: h?.location ?? '',
    startDate: h?.startDate ? dateKey(h.startDate) : '', endDate: h?.endDate ? dateKey(h.endDate) : '',
    status: h?.status ?? 'INTERESTED',
    registrationDeadline: toLocalInput(h?.registrationDeadline ?? null),
    submissionDeadline: toLocalInput(h?.submissionDeadline ?? null),
    projectName: h?.projectName ?? '', projectDescription: h?.projectDescription ?? '',
    techStack: h?.techStack.join(', ') ?? '', teammates: h?.teammates.join(', ') ?? '',
    repoUrl: h?.repoUrl ?? '', demoUrl: h?.demoUrl ?? '',
    won: h?.won ?? false, placement: h?.placement ?? '', prizeName: h?.prizeName ?? '',
    prizeAmount: h?.prizeAmount != null ? String(h.prizeAmount) : '', notes: h?.notes ?? '',
    assigneeIds: (h?.assignees ?? []).map((a) => a.id).sort(),
  };
}

const text = (v: string) => v.trim() || null;
const list = (v: string) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))];
const day = (v: string) => (v ? `${v}T00:00:00.000Z` : null);
const moment = (v: string) => (v ? new Date(v).toISOString() : null);
// People paste links without a scheme, so add one.
const link = (v: string) => {
  const t = v.trim();
  return t ? (/^https?:\/\//i.test(t) ? t : `https://${t}`) : null;
};

/** withAssignees is set for team hackathons that already exist; new ones get assignees after saving. */
function toInput(f: FormState, withAssignees = false): HackathonInput {
  return {
    ...(withAssignees ? { assigneeIds: [...f.assigneeIds].sort() } : {}),
    name: f.name.trim(), organizer: text(f.organizer), url: link(f.url), format: f.format, location: text(f.location),
    startDate: day(f.startDate), endDate: day(f.endDate), status: f.status,
    registrationDeadline: moment(f.registrationDeadline), submissionDeadline: moment(f.submissionDeadline),
    projectName: text(f.projectName), projectDescription: text(f.projectDescription),
    techStack: list(f.techStack), teammates: list(f.teammates), repoUrl: link(f.repoUrl), demoUrl: link(f.demoUrl),
    won: f.won, placement: text(f.placement), prizeName: text(f.prizeName),
    prizeAmount: f.prizeAmount.trim() ? Math.max(0, Math.round(Number(f.prizeAmount))) : null,
    notes: text(f.notes),
  };
}

/**
 * Only the fields this person changed. In a team someone else may have saved other
 * fields since the drawer opened, and sending everything would overwrite their work.
 */
function changedFields(before: HackathonInput, after: HackathonInput): HackathonInput {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof HackathonInput)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out[key] = after[key];
  }
  return out as HackathonInput;
}

export function HackathonDrawer({ hackathon, onClose }: { hackathon: Hackathon | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(() => toForm(hackathon));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useSaveHackathon();
  const remove = useDeleteHackathon();
  const spaces = useSpaces();
  const [tab, setTab] = useState<Tab>('details');
  // Fresh counts for the tab badges; the prop is a snapshot from when the drawer opened.
  const live = useHackathons().data?.find((h) => h.id === hackathon?.id) ?? hackathon;
  const team = hackathon?.spaceId ? (spaces.data?.find((s) => s.id === hackathon.spaceId) ?? null) : null;
  const assignable = Boolean(hackathon && team);
  const busy = save.isPending || remove.isPending;

  // showModal gives a focus trap and Esc-to-close for free.
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const field = (key: keyof FormState) => ({
    id: `f-${key}`,
    value: form[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.prizeAmount.trim() && Number.isNaN(Number(form.prizeAmount))) {
      setError('Enter the prize amount as a number, without symbols.');
      return;
    }
    const input = hackathon ? changedFields(toInput(toForm(hackathon), assignable), toInput(form, assignable)) : toInput(form);
    if (hackathon && !Object.keys(input).length) return onClose();
    save.mutate({ id: hackathon?.id, input }, { onSuccess: onClose, onError: (e) => setError(e.message) });
  };

  const destroy = () => {
    if (!hackathon) return;
    remove.mutate(hackathon.id, { onSuccess: onClose, onError: (e) => setError(e.message) });
  };

  return (
    <dialog
      ref={dialog}
      className="drawer"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      aria-labelledby="drawer-title"
    >
      <form className="drawer-panel" onSubmit={submit} noValidate={false}>
        <header className="drawer-head">
          <h2 id="drawer-title">{hackathon ? 'Edit hackathon' : 'Add hackathon'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>

        {hackathon && (
          <div className="drawer-tabs" role="tablist" aria-label="Sections">
            {([
              ['details', 'Details', null],
              ['tasks', 'Tasks', live?.taskCount ? `${live.tasksDone}/${live.taskCount}` : null],
              ...(team ? [['comments', 'Comments', live?.commentCount || null]] : []),
            ] as [Tab, string, string | number | null][]).map(([id, label, badge]) => (
              <button type="button" role="tab" key={id} aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
                {label}{badge !== null && <b>{badge}</b>}
              </button>
            ))}
          </div>
        )}

        {hackathon && tab === 'tasks' && (
          <div className="drawer-body">
            <TasksPanel hackathonId={hackathon.id} members={team?.members ?? null} />
          </div>
        )}
        {hackathon && tab === 'comments' && team && (
          <div className="drawer-body">
            <CommentsPanel hackathonId={hackathon.id} isOwner={team.role === 'OWNER'} />
          </div>
        )}

        <div className="drawer-body" hidden={tab !== 'details'}>
          {assignable && team && (
            <fieldset>
              <legend>Assigned to</legend>
              <AssigneePicker members={team.members} value={form.assigneeIds} onChange={(ids) => set('assigneeIds', ids)} />
              <p className="hint">Who is on this one. Their faces show on the board card.</p>
            </fieldset>
          )}
          <fieldset>
            <legend>Basics</legend>
            <label className="field" htmlFor="f-name">
              <span>Name</span>
              <input {...field('name')} required maxLength={120} placeholder="Open Data Jam" autoFocus />
            </label>
            <div className="field-row">
              <label className="field" htmlFor="f-organizer">
                <span>Organizer</span>
                <input {...field('organizer')} maxLength={120} placeholder="Who runs it" />
              </label>
              <label className="field" htmlFor="f-url">
                <span>Link</span>
                <input {...field('url')} inputMode="url" maxLength={500} placeholder="devpost.com/..." />
              </label>
            </div>
            <div className="field-row">
              <label className="field" htmlFor="f-format">
                <span>Format</span>
                <select id="f-format" value={form.format} onChange={(e) => set('format', e.target.value as Format)}>
                  {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
                </select>
              </label>
              <label className="field" htmlFor="f-location">
                <span>Location</span>
                <input {...field('location')} maxLength={120} placeholder="City or venue" />
              </label>
            </div>
            <div className="field-row">
              <label className="field" htmlFor="f-startDate">
                <span>Starts</span>
                <input {...field('startDate')} type="date" />
              </label>
              <label className="field" htmlFor="f-endDate">
                <span>Ends</span>
                <input {...field('endDate')} type="date" min={form.startDate || undefined} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Status and deadlines</legend>
            <div className="status-picker" role="radiogroup" aria-label="Status">
              {STATUSES.map((s) => (
                <label key={s} className={`status-option pill-${s.toLowerCase()}${form.status === s ? ' is-on' : ''}`}>
                  <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => set('status', s)} />
                  {STATUS_LABEL[s]}
                </label>
              ))}
            </div>
            <div className="field-row">
              <label className="field" htmlFor="f-registrationDeadline">
                <span>Registration closes</span>
                <input {...field('registrationDeadline')} type="datetime-local" />
              </label>
              <label className="field" htmlFor="f-submissionDeadline">
                <span>Submission closes</span>
                <input {...field('submissionDeadline')} type="datetime-local" />
              </label>
            </div>
            <p className="hint">Deadlines use your local time. Grind emails you 3 days and 1 day before submission closes.</p>
          </fieldset>

          <fieldset>
            <legend>Project and team</legend>
            <label className="field" htmlFor="f-projectName">
              <span>Project name</span>
              <input {...field('projectName')} maxLength={120} placeholder="What you are building" />
            </label>
            <label className="field" htmlFor="f-projectDescription">
              <span>What it does</span>
              <textarea {...field('projectDescription')} rows={3} maxLength={2000} />
            </label>
            <div className="field-row">
              <label className="field" htmlFor="f-techStack">
                <span>Tech stack</span>
                <input {...field('techStack')} placeholder="React, NestJS, Postgres" />
              </label>
              <label className="field" htmlFor="f-teammates">
                <span>Teammates</span>
                <input {...field('teammates')} placeholder="Amara, Tobi" />
              </label>
            </div>
            <p className="hint">Separate items with commas.</p>
            <div className="field-row">
              <label className="field" htmlFor="f-repoUrl">
                <span>Repository</span>
                <input {...field('repoUrl')} inputMode="url" maxLength={500} placeholder="github.com/..." />
              </label>
              <label className="field" htmlFor="f-demoUrl">
                <span>Demo</span>
                <input {...field('demoUrl')} inputMode="url" maxLength={500} placeholder="Live link or video" />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Results</legend>
            <label className="check">
              <input type="checkbox" checked={form.won} onChange={(e) => set('won', e.target.checked)} />
              <span>We won something</span>
            </label>
            <div className="field-row">
              <label className="field" htmlFor="f-placement">
                <span>Placement</span>
                <input {...field('placement')} maxLength={60} placeholder="2nd place, finalist" />
              </label>
              <label className="field" htmlFor="f-prizeName">
                <span>Prize</span>
                <input {...field('prizeName')} maxLength={120} placeholder="Best use of open data" />
              </label>
            </div>
            <label className="field field-narrow" htmlFor="f-prizeAmount">
              <span>Prize money (USD)</span>
              <input {...field('prizeAmount')} inputMode="numeric" placeholder="0" />
            </label>
            <label className="field" htmlFor="f-notes">
              <span>Notes and lessons</span>
              <textarea {...field('notes')} rows={4} maxLength={5000} placeholder="What to repeat, what to skip next time" />
            </label>
          </fieldset>
        </div>

        <footer className="drawer-foot">
          {hackathon?.spaceId && (
            <p className="drawer-byline">
              Added by {hackathon.user.name}
              {hackathon.updatedBy && hackathon.updatedAt !== hackathon.createdAt ? `, last edited by ${hackathon.updatedBy.name}` : ''}
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="drawer-actions">
            {hackathon &&
              (confirmDelete ? (
                <span className="confirm">
                  Delete this hackathon?
                  <button type="button" className="btn btn-danger" onClick={destroy} disabled={busy}>{remove.isPending && <Spinner />}Delete</button>
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
                </span>
              ) : (
                <button type="button" className="btn btn-quiet btn-danger-text" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
              ))}
            <span className="spacer" />
            {tab !== 'details' && <span className="hint">Tasks and comments save as you go.</span>}
            <button type="button" className="btn btn-quiet" onClick={onClose}>{tab === 'details' ? 'Cancel' : 'Close'}</button>
            <button type="submit" className="btn btn-ink" disabled={busy}>
              {save.isPending && <Spinner />}
              {save.isPending ? 'Saving' : hackathon ? 'Save changes' : 'Add hackathon'}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
