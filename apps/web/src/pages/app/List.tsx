import { useMemo, useState } from 'react';
import { EmptyState, PageHead, useShell } from '../../components/AppShell';
import { Countdown, StatusPill } from '../../components/Bits';
import { IconSearch, IconTrophy } from '../../components/Icons';
import { ListSkeleton } from '../../components/Loading';
import { useHackathons } from '../../lib/hooks';
import { formatRange } from '../../lib/time';
import { FORMAT_LABEL, STATUSES, STATUS_LABEL, type Hackathon, type Status } from '../../lib/types';

type Sort = 'deadline' | 'start' | 'added' | 'name';

const FAR = '9999';
const SORTS: Record<Sort, (a: Hackathon, b: Hackathon) => number> = {
  deadline: (a, b) => (a.submissionDeadline ?? FAR).localeCompare(b.submissionDeadline ?? FAR),
  start: (a, b) => (a.startDate ?? FAR).localeCompare(b.startDate ?? FAR),
  added: (a, b) => b.createdAt.localeCompare(a.createdAt),
  name: (a, b) => a.name.localeCompare(b.name),
};

export function ListPage() {
  const { openEditor } = useShell();
  const query = useHackathons();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status | 'ALL'>('ALL');
  const [sort, setSort] = useState<Sort>('deadline');
  const list = query.data ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list
      .filter((h) => status === 'ALL' || h.status === status)
      .filter((h) =>
        !q ||
        [h.name, h.organizer, h.projectName, h.location, ...h.techStack, ...h.teammates]
          .some((v) => v?.toLowerCase().includes(q)),
      )
      .sort(SORTS[sort]);
  }, [list, search, status, sort]);

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <div className="page-error" role="alert">{query.error.message}</div>;

  return (
    <>
      <PageHead title="Hackathons" sub="Everything you are tracking, in one list." />
      {!list.length ? (
        <EmptyState onAdd={() => openEditor()} />
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <IconSearch />
              <input
                id="list-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, project, tech, teammate"
                aria-label="Search hackathons"
              />
            </label>
            <label className="sort">
              <span>Sort by</span>
              <select id="list-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="deadline">Submission deadline</option>
                <option value="start">Start date</option>
                <option value="added">Recently added</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>

          <div className="filters" role="group" aria-label="Filter by status">
            <button type="button" className={status === 'ALL' ? 'is-on' : ''} aria-pressed={status === 'ALL'} onClick={() => setStatus('ALL')}>
              All <b>{list.length}</b>
            </button>
            {STATUSES.map((s) => (
              <button type="button" key={s} className={status === s ? 'is-on' : ''} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {STATUS_LABEL[s]} <b>{list.filter((h) => h.status === s).length}</b>
              </button>
            ))}
          </div>

          {rows.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Hackathon</th>
                    <th>Status</th>
                    <th className="col-dates">Dates</th>
                    <th>Submission</th>
                    <th className="col-project">Project</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <tr key={h.id} onClick={() => openEditor(h)}>
                      <td>
                        <button type="button" className="row-title" onClick={(e) => { e.stopPropagation(); openEditor(h); }}>
                          {h.name}
                        </button>
                        <span className="row-sub">
                          {[h.organizer, FORMAT_LABEL[h.format], h.location].filter(Boolean).join(', ')}
                        </span>
                      </td>
                      <td><StatusPill status={h.status} /></td>
                      <td className="col-dates">{formatRange(h.startDate, h.endDate)}</td>
                      <td>
                        {h.submissionDeadline ? (
                          h.status === 'SUBMITTED' || h.status === 'DONE'
                            ? <span className="muted">Submitted</span>
                            : <Countdown iso={h.submissionDeadline} />
                        ) : <span className="muted">Not set</span>}
                      </td>
                      <td className="col-project">
                        {h.projectName ?? <span className="muted">No project yet</span>}
                        {h.won && <span className="win-badge"><IconTrophy />{h.placement ?? 'Won'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-match">Nothing matches that search and filter. <button type="button" className="link" onClick={() => { setSearch(''); setStatus('ALL'); }}>Clear filters</button></p>
          )}
        </>
      )}
    </>
  );
}
