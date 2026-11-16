import { useMemo, useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { IconCheck, IconPlus, IconSearch } from '../../components/Icons';
import { useDiscover, useHackathons, useSaveHackathon, useSpaces } from '../../lib/hooks';
import { useSpaceId } from '../../lib/space';
import { formatMoment, formatRange } from '../../lib/time';
import { FORMATS, FORMAT_LABEL, SOURCES, type Format, type HackathonInput, type Listing, type Source } from '../../lib/types';

const SOURCE_LABEL: Record<Source, string> = { devpost: 'Devpost', dorahacks: 'DoraHacks', devfolio: 'Devfolio', mlh: 'MLH' };

/** Compares links without scheme, "www." and trailing slash, so the same event matches. */
const linkKey = (url: string | null) =>
  (url ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');

type Sort = 'closing' | 'starting' | 'name';
const FAR = '9999';
const closesAt = (h: Listing) => h.submissionDeadline?.slice(0, 10) ?? h.endDate ?? FAR;
const SORTS: Record<Sort, (a: Listing, b: Listing) => number> = {
  closing: (a, b) => closesAt(a).localeCompare(closesAt(b)),
  starting: (a, b) => (a.startDate ?? FAR).localeCompare(b.startDate ?? FAR),
  name: (a, b) => a.name.localeCompare(b.name),
};

const toDay = (day: string | null) => (day ? `${day}T00:00:00.000Z` : null);

function toInput(h: Listing): HackathonInput {
  return {
    name: h.name.slice(0, 120),
    organizer: h.organizer?.slice(0, 120) ?? null,
    url: h.url,
    format: h.format,
    location: h.location?.slice(0, 120) ?? null,
    startDate: toDay(h.startDate),
    endDate: toDay(h.endDate),
    registrationDeadline: h.registrationDeadline,
    submissionDeadline: h.submissionDeadline,
    status: 'INTERESTED',
    notes: [h.prize, `Found on ${SOURCE_LABEL[h.source]}.`].filter(Boolean).join('. '),
  };
}

function ListingCard({ h, added, onAdd, busy }: { h: Listing; added: boolean; onAdd: () => void; busy: boolean }) {
  return (
    <article className="listing">
      <div className="listing-top">
        {h.imageUrl ? (
          <img src={h.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="listing-img-empty" aria-hidden="true">{h.name.slice(0, 1)}</span>
        )}
        <div className="listing-head">
          <span className={`source source-${h.source}`}>{SOURCE_LABEL[h.source]}</span>
          <h2>
            <a href={h.url} target="_blank" rel="noopener noreferrer">{h.name}</a>
          </h2>
          {h.organizer && <p className="listing-org">{h.organizer}</p>}
        </div>
      </div>
      <p className="listing-meta">
        {formatRange(h.startDate ? toDay(h.startDate) : null, h.endDate ? toDay(h.endDate) : null)}
        {' · '}
        {h.location ?? FORMAT_LABEL[h.format]}
      </p>
      {(h.registrationDeadline || h.submissionDeadline) && (
        <p className="listing-meta">
          {h.registrationDeadline && <>Registration closes {formatMoment(h.registrationDeadline)}</>}
          {h.submissionDeadline && <>Submission closes {formatMoment(h.submissionDeadline)}</>}
        </p>
      )}
      {h.prize && <p className="listing-prize">{h.prize}</p>}
      {h.tags.length > 0 && (
        <span className="chips">
          {h.tags.slice(0, 4).map((t) => <span className="chip" key={t}>{t}</span>)}
          {h.tags.length > 4 && <span className="chip">+{h.tags.length - 4}</span>}
        </span>
      )}
      <div className="listing-actions">
        {added ? (
          <span className="listing-added"><IconCheck /> In this list</span>
        ) : (
          <button type="button" className="btn btn-ink" onClick={onAdd} disabled={busy}>
            <IconPlus /> {busy ? 'Adding' : 'Add to list'}
          </button>
        )}
        <a className="btn btn-quiet" href={h.url} target="_blank" rel="noopener noreferrer">Open site</a>
      </div>
    </article>
  );
}

export function DiscoverPage() {
  const discover = useDiscover();
  const mine = useHackathons();
  const spaces = useSpaces();
  const { spaceId } = useSpaceId();
  const save = useSaveHackathon();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<Source | 'ALL'>('ALL');
  const [format, setFormat] = useState<Format | 'ALL'>('ALL');
  const [sort, setSort] = useState<Sort>('closing');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const listName = spaceId ? (spaces.data?.find((s) => s.id === spaceId)?.name ?? 'shared list') : 'My hackathons';
  const inList = useMemo(() => new Set((mine.data ?? []).map((h) => linkKey(h.url))), [mine.data]);
  const all = discover.data?.hackathons ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((h) => source === 'ALL' || h.source === source)
      .filter((h) => format === 'ALL' || h.format === format)
      .filter((h) => !q || [h.name, h.organizer, h.location, ...h.tags].some((v) => v?.toLowerCase().includes(q)))
      .sort(SORTS[sort]);
  }, [all, search, source, format, sort]);

  const add = (h: Listing) => {
    setError('');
    setAddingId(h.id);
    save.mutate(
      { input: toInput(h) },
      {
        onError: (e) => setError(`${h.name} was not added. ${e.message}`),
        onSettled: () => setAddingId(null),
      },
    );
  };

  if (discover.isPending) return <div className="page-loading" role="status">Collecting hackathons from Devpost, DoraHacks, Devfolio and MLH</div>;
  if (discover.isError) return <div className="page-error" role="alert">{discover.error.message}</div>;

  const failed = discover.data.sources.filter((s) => !s.ok);

  return (
    <>
      <PageHead
        title="Discover"
        sub={`Open and upcoming hackathons from ${discover.data.sources.map((s) => s.label).join(', ')}. Adding one puts it in ${listName}.`}
      />

      {failed.length > 0 && (
        <p className="form-error" role="status">{failed.map((s) => s.error).join(' ')} The other sources are shown.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="toolbar">
        <label className="search">
          <IconSearch />
          <input
            id="discover-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, organizer, city, theme"
            aria-label="Search hackathons"
          />
        </label>
        <label className="sort">
          <span>Format</span>
          <select id="discover-format" value={format} onChange={(e) => setFormat(e.target.value as Format | 'ALL')}>
            <option value="ALL">Any</option>
            {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
          </select>
        </label>
        <label className="sort">
          <span>Sort by</span>
          <select id="discover-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="closing">Closing soonest</option>
            <option value="starting">Starting soonest</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      <div className="filters" role="group" aria-label="Filter by site">
        <button type="button" className={source === 'ALL' ? 'is-on' : ''} aria-pressed={source === 'ALL'} onClick={() => setSource('ALL')}>
          All <b>{all.length}</b>
        </button>
        {SOURCES.map((s) => (
          <button type="button" key={s} className={source === s ? 'is-on' : ''} aria-pressed={source === s} onClick={() => setSource(s)}>
            {SOURCE_LABEL[s]} <b>{all.filter((h) => h.source === s).length}</b>
          </button>
        ))}
      </div>

      {rows.length ? (
        <div className="listings">
          {rows.map((h) => (
            <ListingCard key={h.id} h={h} added={inList.has(linkKey(h.url))} busy={addingId === h.id} onAdd={() => add(h)} />
          ))}
        </div>
      ) : (
        <p className="no-match">
          Nothing matches that search and filter.{' '}
          <button type="button" className="link" onClick={() => { setSearch(''); setSource('ALL'); setFormat('ALL'); }}>Clear filters</button>
        </p>
      )}
      <p className="hint discover-foot">Updated {formatMoment(discover.data.fetchedAt)}. Lists refresh every 30 minutes.</p>
    </>
  );
}
