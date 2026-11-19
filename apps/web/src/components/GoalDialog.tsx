import { useEffect, useMemo, useRef, useState } from 'react';
import { KIND_HINT, KIND_LABEL, PERIODS, PERIOD_LABEL, type Period, goalTitle, periodOf, periodRange } from '../lib/goals';
import { useGoalActions, useHackathons, useSpaces } from '../lib/hooks';
import { useSpaceId } from '../lib/space';
import { GOAL_KINDS, type Goal, type GoalKind } from '../lib/types';
import { IconClose } from './Icons';
import { Spinner } from './Loading';

/** Add or edit a goal. Team goals can be made only while a shared list is open. */
export function GoalDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { spaceId } = useSpaceId();
  const spaces = useSpaces();
  const hackathons = useHackathons();
  const actions = useGoalActions();

  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'ENTER');
  const [target, setTarget] = useState(goal?.target ? String(goal.target) : '');
  const [tech, setTech] = useState(goal?.tech ?? '');
  const [title, setTitle] = useState(goal?.title ?? '');
  const [period, setPeriod] = useState<Period>(goal ? periodOf(goal) : 'year');
  const [start, setStart] = useState(goal?.startDate?.slice(0, 10) ?? '');
  const [end, setEnd] = useState(goal?.endDate?.slice(0, 10) ?? '');
  const [team, setTeam] = useState(Boolean(goal?.spaceId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const teamName = spaceId ? spaces.data?.find((s) => s.id === spaceId)?.name : undefined;
  const techOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const h of hackathons.data ?? []) for (const t of h.techStack) seen.set(t.toLowerCase(), t);
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [hackathons.data]);

  const custom = kind === 'CUSTOM';
  const number = Number(target);
  // Matches the target field's own placeholder until a number is typed.
  const preview = goalTitle({ kind, title: null, target: number || (kind === 'PRIZE' ? 5000 : 5), tech: tech.trim() || 'Rust' });

  const pickPeriod = (p: Period) => {
    setPeriod(p);
    const range = periodRange(p);
    if (range) {
      setStart(range.start);
      setEnd(range.end);
    } else if (p === 'none') {
      setStart('');
      setEnd('');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (custom && !title.trim()) return setError('Write what the goal is.');
    if (!custom && (!Number.isInteger(number) || number < 1)) return setError('Set a target of 1 or more.');
    if (kind === 'TECH' && !tech.trim()) return setError('Name the technology to count.');
    if (period === 'custom' && start && end && end < start) return setError('The end date is before the start date.');

    const range = period === 'custom' ? { start, end } : periodRange(period);
    const input = {
      kind,
      title: title.trim() || null,
      target: custom ? null : number,
      tech: kind === 'TECH' ? tech.trim() : null,
      startDate: range?.start || null,
      endDate: range?.end || null,
    };
    setSaving(true);
    try {
      if (goal) await actions.update(goal.id, input);
      else await actions.create({ ...input, spaceId: team && spaceId ? spaceId : null });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="modal modal-sm"
      onClose={onClose}
      onCancel={(e) => saving && e.preventDefault()}
      onClick={(e) => e.target === dialog.current && !saving && onClose()}
      aria-labelledby="goal-title"
    >
      <form className="modal-panel" onSubmit={submit}>
        <header className="drawer-head">
          <h2 id="goal-title">{goal ? 'Edit goal' : 'New goal'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} disabled={saving} aria-label="Close">
            <IconClose />
          </button>
        </header>

        <div className="drawer-body goal-form">
          {!goal && teamName && (
            <div className="field">
              <span>Whose goal</span>
              <div className="segmented" role="group" aria-label="Whose goal">
                <button type="button" className={!team ? 'is-on' : undefined} aria-pressed={!team} onClick={() => setTeam(false)}>Just me</button>
                <button type="button" className={team ? 'is-on' : undefined} aria-pressed={team} onClick={() => setTeam(true)}>{teamName}</button>
              </div>
              <small>{team ? `Everyone in ${teamName} sees it, and it counts this list's hackathons.` : 'Only you see it. It counts your private list, plus team hackathons you added or are assigned to.'}</small>
            </div>
          )}

          <fieldset className="field goal-kinds">
            <legend>What to count</legend>
            <div className="goal-kind-grid">
              {GOAL_KINDS.map((k) => (
                <label key={k} className={`goal-kind${kind === k ? ' is-on' : ''}`}>
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                  {KIND_LABEL[k]}
                </label>
              ))}
            </div>
            <small>{KIND_HINT[kind]}</small>
          </fieldset>

          {custom ? (
            <label className="field">
              <span>Goal</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ship a mobile app at a hackathon" autoFocus />
            </label>
          ) : (
            <div className="field-row">
              <label className="field">
                <span>{kind === 'PRIZE' ? 'Target in dollars' : 'Target'}</span>
                <input type="number" inputMode="numeric" min={1} step={1} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={kind === 'PRIZE' ? '5000' : '5'} />
              </label>
              {kind === 'TECH' && (
                <label className="field">
                  <span>Tech</span>
                  <input value={tech} onChange={(e) => setTech(e.target.value)} maxLength={60} list="goal-tech" placeholder="Rust" />
                  <datalist id="goal-tech">{techOptions.map((t) => <option key={t} value={t} />)}</datalist>
                </label>
              )}
            </div>
          )}

          <div className="field">
            <span>When</span>
            <div className="filter-chips" role="group" aria-label="When">
              {PERIODS.map((p) => (
                <button key={p} type="button" className={period === p ? 'is-on' : ''} aria-pressed={period === p} onClick={() => pickPeriod(p)}>
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="field-row">
                <label className="field">
                  <span>From</span>
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </label>
                <label className="field">
                  <span>To</span>
                  <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
                </label>
              </div>
            )}
            <small>A hackathon counts on the day it ends, or the day it starts, or the day you added it.</small>
          </div>

          {!custom && (
            <label className="field">
              <span>Name <em className="optional">optional</em></span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={preview} />
            </label>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <footer className="drawer-foot">
          <div className="drawer-actions goal-actions">
            <button type="button" className="btn btn-quiet" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-accent" disabled={saving}>
              {saving && <Spinner />} {goal ? 'Save goal' : 'Add goal'}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
