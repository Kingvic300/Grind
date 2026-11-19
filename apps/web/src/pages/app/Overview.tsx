import { AddButton, EmptyState, PageHead, useShell } from '../../components/AppShell';
import { Countdown } from '../../components/Bits';
import { Link } from 'react-router-dom';
import { Bone, OverviewSkeleton } from '../../components/Loading';
import { reached, timeLeft } from '../../lib/goals';
import { useGoals, useHackathons, useMe, useNow } from '../../lib/hooks';
import { GoalCard } from './Goals';
import { formatMoment, money } from '../../lib/time';
import { STATUSES, STATUS_LABEL, type Hackathon } from '../../lib/types';

type Deadline = { hackathon: Hackathon; kind: string; at: string };

/** Open deadlines that still matter, soonest first. */
function upcomingDeadlines(list: Hackathon[], now: number): Deadline[] {
  const out: Deadline[] = [];
  for (const h of list) {
    if (h.registrationDeadline && h.status === 'INTERESTED') out.push({ hackathon: h, kind: 'Registration closes', at: h.registrationDeadline });
    if (h.submissionDeadline && !['SUBMITTED', 'DONE'].includes(h.status)) out.push({ hackathon: h, kind: 'Submission closes', at: h.submissionDeadline });
  }
  return out.filter((d) => new Date(d.at).getTime() > now).sort((a, b) => a.at.localeCompare(b.at));
}

/** Goals still in play, closest to their end date first. Reached and ended ones stay on the Goals page. */
function GoalsPanel() {
  const query = useGoals();
  if (query.isPending) {
    return (
      <section className="panel overview-goals" aria-busy="true">
        <Bone className="sk-line" style={{ width: '30%', height: 18 }} />
        <div className="goal-grid">{[0, 1, 2].map((i) => <Bone key={i} className="sk-row" style={{ height: 62 }} />)}</div>
      </section>
    );
  }
  if (query.isError) return null;
  const open = query.data
    .filter((g) => !reached(g) && !timeLeft(g)?.ended)
    .sort((a, b) => (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999'))
    .slice(0, 3);
  return (
    <section className="panel overview-goals">
      <div className="panel-head">
        <h2>Goals</h2>
        <Link to="/app/goals" className="text-link">{query.data.length ? 'All goals' : 'Set a goal'}</Link>
      </div>
      {open.length ? (
        <div className="goal-grid">{open.map((g) => <GoalCard key={g.id} goal={g} compact />)}</div>
      ) : (
        <p className="panel-empty">
          {query.data.length ? 'Every goal is reached or ended. Time for a new one.' : 'Aim for a number of hackathons, wins or prize money, and watch it fill in.'}
        </p>
      )}
    </section>
  );
}

export function OverviewPage() {
  const { openEditor } = useShell();
  const me = useMe();
  const query = useHackathons();
  const now = useNow(60_000);
  const list = query.data ?? [];

  if (query.isPending) return <OverviewSkeleton />;
  if (query.isError) return <div className="page-error" role="alert">{query.error.message}</div>;

  const firstName = me.data?.name.split(' ')[0];
  if (!list.length) {
    return (
      <>
        <PageHead title={`Welcome, ${firstName}`} sub="This page fills in as you track hackathons." />
        <EmptyState onAdd={() => openEditor()} />
      </>
    );
  }

  const submitted = list.filter((h) => h.status === 'SUBMITTED' || h.status === 'DONE').length;
  const wins = list.filter((h) => h.won).length;
  const prize = list.reduce((sum, h) => sum + (h.prizeAmount ?? 0), 0);
  const deadlines = upcomingDeadlines(list, now).slice(0, 6);
  const tech = new Map<string, number>();
  for (const h of list) for (const t of h.techStack) tech.set(t, (tech.get(t) ?? 0) + 1);
  const topTech = [...tech.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxTech = topTech[0]?.[1] ?? 1;

  return (
    <>
      <PageHead title="Overview" sub={`${list.length} hackathon${list.length === 1 ? '' : 's'} tracked`}>
        <AddButton />
      </PageHead>

      <section className="tiles" aria-label="Totals">
        <div className="tile"><span>Tracked</span><strong>{list.length}</strong></div>
        <div className="tile"><span>Submitted</span><strong>{submitted}</strong></div>
        <div className="tile"><span>Wins</span><strong>{wins}</strong>{submitted > 0 && <em>{Math.round((wins / submitted) * 100)}% of submissions</em>}</div>
        <div className="tile tile-accent"><span>Prize money</span><strong>{money(prize)}</strong></div>
      </section>

      <GoalsPanel />

      <div className="overview-grid">
        <section className="panel">
          <h2>Next deadlines</h2>
          {deadlines.length ? (
            <ul className="deadline-list">
              {deadlines.map((d) => (
                <li key={d.hackathon.id + d.kind}>
                  <button type="button" onClick={() => openEditor(d.hackathon)}>
                    <span className="deadline-text">
                      <strong>{d.hackathon.name}</strong>
                      <span>{d.kind} {formatMoment(d.at)}</span>
                    </span>
                    <Countdown iso={d.at} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-empty">No open deadlines. Add a submission deadline to a hackathon and it shows up here.</p>
          )}
        </section>

        <section className="panel">
          <h2>Where things stand</h2>
          <div className="status-bar" role="img" aria-label="Hackathons by status">
            {STATUSES.map((s) => {
              const count = list.filter((h) => h.status === s).length;
              return count ? <i key={s} className={`bg-${s.toLowerCase()}`} style={{ flexGrow: count }} /> : null;
            })}
          </div>
          <ul className="status-legend">
            {STATUSES.map((s) => (
              <li key={s}>
                <span className={`dot dot-${s.toLowerCase()}`} />
                {STATUS_LABEL[s]}
                <b>{list.filter((h) => h.status === s).length}</b>
              </li>
            ))}
          </ul>

          <h2 className="panel-sub">Tech you reach for</h2>
          {topTech.length ? (
            <ul className="bars">
              {topTech.map(([name, count]) => (
                <li key={name}>
                  <span>{name}</span>
                  <i style={{ width: `${(count / maxTech) * 100}%` }} />
                  <b>{count}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-empty">Add a tech stack to a hackathon to see what you use most.</p>
          )}
        </section>
      </div>
    </>
  );
}
