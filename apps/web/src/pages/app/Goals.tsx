import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { GoalDialog } from '../../components/GoalDialog';
import { IconCheck, IconPlus, IconTrash } from '../../components/Icons';
import { PanelsSkeleton, Spinner } from '../../components/Loading';
import { fraction, goalTitle, progressText, reached, timeLeft, windowLabel } from '../../lib/goals';
import { useGoalActions, useGoals, useSpaces } from '../../lib/hooks';
import { useSpaceId } from '../../lib/space';
import type { Goal } from '../../lib/types';

type Editing = { goal: Goal | null } | null;

/** Open goals first, then reached ones, then the rest that ended. */
function sortGoals(goals: Goal[]) {
  const rank = (g: Goal) => (timeLeft(g)?.ended ? 2 : reached(g) ? 1 : 0);
  return [...goals].sort((a, b) => rank(a) - rank(b) || (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999'));
}

/** One goal with its progress bar. Used on the Goals page and, compact, on Overview. */
export function GoalCard({ goal, onEdit, compact = false }: { goal: Goal; onEdit?: () => void; compact?: boolean }) {
  const actions = useGoalActions();
  const [busy, setBusy] = useState<'tick' | 'delete' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const done = reached(goal);
  const left = timeLeft(goal);
  const missed = left?.ended && !done;
  const state = done ? 'is-reached' : missed ? 'is-missed' : '';

  const run = async (kind: 'tick' | 'delete', job: () => Promise<unknown>) => {
    setBusy(kind);
    setError('');
    try {
      await job();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
      return;
    }
    setBusy(null);
  };

  return (
    <article className={`goal ${state}${compact ? ' goal-compact' : ''}`}>
      <div className="goal-top">
        {goal.kind === 'CUSTOM' && (
          <button
            type="button"
            className={`goal-tick${goal.done ? ' is-on' : ''}`}
            onClick={() => run('tick', () => actions.update(goal.id, { done: !goal.done }))}
            disabled={busy !== null}
            aria-pressed={goal.done}
            aria-label={goal.done ? 'Mark as not done' : 'Mark as done'}
          >
            {busy === 'tick' ? <Spinner /> : goal.done && <IconCheck />}
          </button>
        )}
        <div className="goal-text">
          <h3>{goalTitle(goal)}</h3>
          <p>
            {windowLabel(goal)}
            {left && <span className={left.ended ? '' : 'goal-left'}> · {left.text}</span>}
          </p>
        </div>
        <span className="goal-badge">{done ? 'Reached' : missed ? 'Missed' : progressText(goal)}</span>
      </div>

      {goal.kind !== 'CUSTOM' && (
        <div className="goal-bar" role="progressbar" aria-label={goalTitle(goal)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction(goal) * 100)}>
          <i style={{ width: `${fraction(goal) * 100}%` }} />
        </div>
      )}

      {!compact && goal.kind !== 'CUSTOM' && (
        <p className="goal-detail">
          {done && <b>{progressText(goal)}. </b>}
          {goal.counted.length
            ? <>Counted: {goal.counted.map((h) => h.name).join(', ')}</>
            : 'Nothing counted yet.'}
        </p>
      )}

      {!compact && onEdit && (
        <div className="goal-actions">
          {confirm ? (
            <span className="confirm">
              Delete this goal?
              <button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => run('delete', () => actions.remove(goal.id))}>
                {busy === 'delete' && <Spinner />} Delete
              </button>
              <button type="button" className="btn btn-quiet btn-sm" disabled={busy !== null} onClick={() => setConfirm(false)}>Keep</button>
            </span>
          ) : (
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={onEdit}>Edit</button>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setConfirm(true)} aria-label="Delete goal" title="Delete goal">
                <IconTrash />
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}

function GoalGroup({ title, sub, goals, onEdit }: { title: string; sub: string; goals: Goal[]; onEdit: (g: Goal) => void }) {
  return (
    <section className="goal-group" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <p>{sub}</p>
      </header>
      {goals.length ? (
        <div className="goal-grid">
          {sortGoals(goals).map((g) => <GoalCard key={g.id} goal={g} onEdit={() => onEdit(g)} />)}
        </div>
      ) : (
        <p className="panel-empty">No goals here yet.</p>
      )}
    </section>
  );
}

export function GoalsPage() {
  const query = useGoals();
  const spaces = useSpaces();
  const { spaceId } = useSpaceId();
  const [editing, setEditing] = useState<Editing>(null);
  const teamName = spaceId ? spaces.data?.find((s) => s.id === spaceId)?.name : undefined;

  if (query.isPending) return <PanelsSkeleton label="Loading your goals" />;
  if (query.isError) return <div className="page-error" role="alert">{query.error.message}</div>;

  const goals = query.data;
  const personal = goals.filter((g) => !g.spaceId);
  const team = goals.filter((g) => g.spaceId);
  const open = goals.filter((g) => !reached(g) && !timeLeft(g)?.ended).length;

  return (
    <>
      <PageHead title="Goals" sub={goals.length ? `${open} in progress, ${goals.filter(reached).length} reached` : 'Set targets and watch them fill in as you track hackathons.'}>
        <button type="button" className="btn btn-accent" onClick={() => setEditing({ goal: null })}>
          <IconPlus /> New goal
        </button>
      </PageHead>

      {!goals.length ? (
        <div className="empty">
          <div className="empty-prompt" aria-hidden="true"><span>&gt;</span> grind goal<i /></div>
          <h2>No goals yet</h2>
          <p>Aim for a number of hackathons, wins or prize money, or write your own goal. Progress counts itself.</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-accent" onClick={() => setEditing({ goal: null })}><IconPlus /> New goal</button>
          </div>
        </div>
      ) : (
        <div className="goal-groups">
          <GoalGroup title="Personal" sub="Only you see these." goals={personal} onEdit={(g) => setEditing({ goal: g })} />
          {teamName && <GoalGroup title={teamName} sub="Team goals. Everyone in this list sees and edits them." goals={team} onEdit={(g) => setEditing({ goal: g })} />}
        </div>
      )}

      {editing && <GoalDialog key={editing.goal?.id ?? 'new'} goal={editing.goal} onClose={() => setEditing(null)} />}
    </>
  );
}
