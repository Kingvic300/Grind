import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../../components/AppShell';
import { IconCheck, IconClose, IconPlus, IconSearch } from '../../components/Icons';
import { CardsSkeleton, Spinner } from '../../components/Loading';
import { useDiscover, useHackathons, useMe, useNow, useSaveHackathon, useSpaces } from '../../lib/hooks';
import { useSpaceId } from '../../lib/space';
import { useViewedListings } from '../../lib/viewed';
import { formatMoment, formatRange } from '../../lib/time';
import {
  CATEGORY_LABEL,
  FORMATS,
  FORMAT_LABEL,
  SOURCES,
  SOURCE_LABEL,
  hasInterests,
  matchesInterests,
  type Category,
  type Format,
  type HackathonInput,
  type Listing,
  type Source,
} from '../../lib/types';

const TOPICS = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => c !== 'web3');
const STACK_PREVIEW = 14;

type Kind = 'all' | 'web3' | 'web2';
type Show = 'all' | 'hackathon' | 'bounty';
type Sort = 'closing' | 'starting' | 'name';
type Window = 'any' | '3' | '7' | '30' | '90';
type Skip = 'show' | 'kind' | 'topics' | 'stacks' | 'sources' | 'format';

const DAY = 24 * 60 * 60 * 1000;
const WINDOWS: { value: Window; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '3', label: 'In 3 days' },
  { value: '7', label: 'In a week' },
  { value: '30', label: 'In a month' },
  { value: '90', label: 'In 3 months' },
];

/** Compares links without scheme, "www." and trailing slash, so the same event matches. */
const linkKey = (url: string | null) =>
  (url ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');

const toDay = (day: string | null) => (day ? `${day}T00:00:00.000Z` : null);

type Closing = { label: string; at: number };

/** The next thing that closes: registration, submission, or the event itself. */
function nextClose(h: Listing, now: number): Closing | null {
  const options: Closing[] = [];
  if (h.registrationDeadline) options.push({ label: 'Registration closes', at: Date.parse(h.registrationDeadline) });
  if (h.submissionDeadline) options.push({ label: 'Submission closes', at: Date.parse(h.submissionDeadline) });
  if (h.endDate) options.push({ label: 'Ends', at: Date.parse(`${h.endDate}T23:59:59Z`) });
  return options.filter((o) => o.at > now).sort((a, b) => a.at - b.at)[0] ?? null;
}

/** "5 hours", "2 days", "3 weeks", "2 months". */
function relative(ms: number): string {
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return 'under an hour';
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(ms / DAY);
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30);
  return `${months} months`;
}

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
    techStack: h.stack.slice(0, 30),
    notes: [h.prize, `Found on ${SOURCE_LABEL[h.source]}${h.kind === 'bounty' ? ' (bounty)' : ''}.`].filter(Boolean).join('. '),
  };
}

const toggle = <T,>(set: Set<T>, value: T) => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

function DeadlineTag({ closing, now }: { closing: Closing | null; now: number }) {
  if (!closing) return null;
  const left = closing.at - now;
  const tone = left <= 3 * DAY ? 'hot' : left <= 14 * DAY ? 'warm' : 'calm';
  return (
    <span className={`due due-${tone}`} title={formatMoment(new Date(closing.at).toISOString())}>
      {closing.label} in {relative(left)}
    </span>
  );
}

type CardProps = { h: Listing; added: boolean; onAdd: () => void; busy: boolean; now: number; match: boolean; viewed: boolean; onView: () => void };

function Badges({ h, match, viewed }: { h: Listing; match: boolean; viewed: boolean }) {
  const web3 = h.categories.includes('web3');
  return (
    <span className="listing-badges">
      <span className={`source source-${h.source}`}>{SOURCE_LABEL[h.source]}</span>
      {h.kind === 'bounty' && <span className="kind kind-bounty">Bounty</span>}
      <span className={`kind kind-${web3 ? 'web3' : 'web2'}`}>{web3 ? 'Web3' : 'Web2'}</span>
      {match && <span className="kind kind-match">Matches you</span>}
      {viewed && <span className="kind kind-viewed">Viewed</span>}
    </span>
  );
}

function ListingImage({ h }: { h: Listing }) {
  return h.imageUrl ? (
    <img src={h.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
  ) : (
    <span className="listing-img-empty" aria-hidden="true">{h.name.slice(0, 1)}</span>
  );
}

function ListingActions({ h, added, onAdd, busy, onView }: Pick<CardProps, 'h' | 'added' | 'onAdd' | 'busy' | 'onView'>) {
  return (
    <>
      {added ? (
        <span className="listing-added"><IconCheck /> In this list</span>
      ) : (
        <button type="button" className="btn btn-ink" onClick={onAdd} disabled={busy}>
          {busy ? <Spinner /> : <IconPlus />} {busy ? 'Adding' : 'Add to list'}
        </button>
      )}
      <a className="btn btn-quiet" href={h.url} target="_blank" rel="noopener noreferrer" onClick={onView} onAuxClick={onView}>Open site</a>
    </>
  );
}

/** Everything known about a listing, so people can judge it without leaving Grind. */
function ListingDetails({ h, added, onAdd, busy, now, match, viewed, onView, onClose }: CardProps & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // showModal gives a focus trap and Esc-to-close for free.
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const deadlines = [
    h.registrationDeadline && { label: 'Registration closes', at: h.registrationDeadline },
    h.submissionDeadline && { label: 'Submission closes', at: h.submissionDeadline },
  ].filter((d): d is { label: string; at: string } => Boolean(d));
  const topics = h.categories.filter((c) => c !== 'web3');
  const tags = h.tags.filter((t) => !h.stack.some((s) => s.toLowerCase() === t.toLowerCase()));

  return (
    <dialog
      ref={dialog}
      className="modal listing-modal"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      aria-labelledby="listing-details-title"
    >
      <div className="modal-panel">
        <header className="drawer-head listing-modal-head">
          <div className="listing-top">
            <ListingImage h={h} />
            <div className="listing-head">
              <Badges h={h} match={match} viewed={viewed} />
              <h2 id="listing-details-title">{h.name}</h2>
              {h.organizer && <p className="listing-org">{h.organizer}</p>}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>

        <div className="drawer-body listing-modal-body">
          <DeadlineTag closing={nextClose(h, now)} now={now} />

          <dl className="listing-facts">
            <div>
              <dt>Dates</dt>
              <dd>{formatRange(toDay(h.startDate), toDay(h.endDate))}</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{h.location ?? FORMAT_LABEL[h.format]}</dd>
            </div>
            {deadlines.map((d) => (
              <div key={d.label}>
                <dt>{d.label}</dt>
                <dd>{formatMoment(d.at)}</dd>
              </div>
            ))}
            {h.prize && (
              <div>
                <dt>Prizes</dt>
                <dd className="listing-prize">{h.prize}</dd>
              </div>
            )}
          </dl>

          <section className="listing-about" aria-label="About">
            <h3>About</h3>
            {h.description ? (
              <p className="listing-full-desc">{h.description}</p>
            ) : (
              <p className="hint">{SOURCE_LABEL[h.source]} does not share a description with Grind. Open the site to read it.</p>
            )}
          </section>

          {(topics.length > 0 || h.stack.length > 0 || tags.length > 0) && (
            <section className="listing-about" aria-label="Topics and tech">
              <h3>Topics and tech</h3>
              <span className="chips">
                {topics.map((c) => <span className="chip chip-topic" key={c}>{CATEGORY_LABEL[c]}</span>)}
                {h.stack.map((t) => <span className="chip chip-stack" key={`s-${t}`}>{t}</span>)}
                {tags.map((t) => <span className="chip" key={`t-${t}`}>{t}</span>)}
              </span>
            </section>
          )}
        </div>

        <footer className="drawer-foot">
          <div className="drawer-actions">
            <ListingActions h={h} added={added} onAdd={onAdd} busy={busy} onView={onView} />
          </div>
        </footer>
      </div>
    </dialog>
  );
}

function ListingCard(props: CardProps) {
  const { h, added, onAdd, busy, now, match, viewed, onView } = props;
  const [open, setOpen] = useState(false);
  const openDetails = () => {
    setOpen(true);
    onView();
  };
  return (
    <article className={`listing${viewed ? ' is-viewed' : ''}`}>
      <div className="listing-top">
        <ListingImage h={h} />
        <div className="listing-head">
          <Badges h={h} match={match} viewed={viewed} />
          <h2>
            <button type="button" className="listing-title" onClick={openDetails}>{h.name}</button>
          </h2>
          {h.organizer && <p className="listing-org">{h.organizer}</p>}
        </div>
      </div>

      <DeadlineTag closing={nextClose(h, now)} now={now} />

      <p className="listing-meta">
        {formatRange(toDay(h.startDate), toDay(h.endDate))}
        {' · '}
        {h.location ?? FORMAT_LABEL[h.format]}
      </p>
      {h.description && <p className="listing-desc">{h.description}</p>}
      <button type="button" className="link listing-more" onClick={openDetails}>
        {h.description ? 'Read more' : 'Details'}
      </button>
      {h.prize && <p className="listing-prize">{h.prize}</p>}

      {(h.categories.length > 0 || h.stack.length > 0) && (
        <span className="chips">
          {h.categories.filter((c) => c !== 'web3').slice(0, 3).map((c) => <span className="chip chip-topic" key={c}>{CATEGORY_LABEL[c]}</span>)}
          {h.stack.slice(0, 4).map((t) => <span className="chip chip-stack" key={t}>{t}</span>)}
        </span>
      )}

      <div className="listing-actions">
        <ListingActions h={h} added={added} onAdd={onAdd} busy={busy} onView={onView} />
      </div>
      {open && <ListingDetails {...props} onClose={() => setOpen(false)} />}
    </article>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  selected,
  onToggle,
  render,
  count,
}: {
  label: string;
  options: T[];
  selected: Set<T>;
  onToggle: (v: T) => void;
  render: (v: T) => string;
  count: (v: T) => number;
}) {
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      <div className="filter-chips" role="group" aria-label={label}>
        {options.map((o) => (
          <button type="button" key={o} className={selected.has(o) ? 'is-on' : ''} aria-pressed={selected.has(o)} onClick={() => onToggle(o)}>
            {render(o)} <b>{count(o)}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DiscoverPage() {
  const discover = useDiscover();
  const me = useMe();
  const interests = me.data && hasInterests(me.data) ? me.data : null;
  // "For you" starts on when the user saved interests in Settings.
  const [forYou, setForYou] = useState<boolean | null>(null);
  const showForYou = forYou ?? Boolean(interests);
  const mine = useHackathons();
  const spaces = useSpaces();
  const { spaceId } = useSpaceId();
  const save = useSaveHackathon();
  const { viewed, markViewed } = useViewedListings();
  const now = useNow(60_000);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [show, setShow] = useState<Show>('all');
  const [topics, setTopics] = useState<Set<Category>>(new Set());
  const [stacks, setStacks] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<Set<Source>>(new Set());
  const [format, setFormat] = useState<Format | 'ALL'>('ALL');
  const [within, setWithin] = useState<Window>('any');
  const [sort, setSort] = useState<Sort>('closing');
  const [showAllStack, setShowAllStack] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const listName = spaceId ? (spaces.data?.find((s) => s.id === spaceId)?.name ?? 'team') : 'My hackathons';
  const inList = useMemo(() => new Set((mine.data ?? []).map((h) => linkKey(h.url))), [mine.data]);
  const all = useMemo(() => discover.data?.hackathons ?? [], [discover.data]);

  const stackOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of all) for (const t of h.stack) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [all]);

  // Every filter except the one being counted, so chip counts show what clicking would give.
  const matches = (h: Listing, skip?: Skip) => {
    if (showForYou && interests && !matchesInterests(h, interests)) return false;
    const q = search.trim().toLowerCase();
    if (q && ![h.name, h.organizer, h.location, h.description, ...h.tags, ...h.stack].some((v) => v?.toLowerCase().includes(q))) return false;
    if (skip !== 'show' && show !== 'all' && h.kind !== show) return false;
    if (skip !== 'kind' && kind !== 'all' && h.categories.includes('web3') !== (kind === 'web3')) return false;
    if (skip !== 'topics' && topics.size && ![...topics].some((t) => h.categories.includes(t))) return false;
    if (skip !== 'stacks' && stacks.size && ![...stacks].some((t) => h.stack.includes(t))) return false;
    if (skip !== 'sources' && sources.size && !sources.has(h.source)) return false;
    if (skip !== 'format' && format !== 'ALL' && h.format !== format) return false;
    if (within !== 'any') {
      const close = nextClose(h, now);
      if (!close || close.at - now > Number(within) * DAY) return false;
    }
    return true;
  };

  const rows = all
    .filter((h) => matches(h))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'starting') return (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999');
      return (nextClose(a, now)?.at ?? Infinity) - (nextClose(b, now)?.at ?? Infinity);
    });

  const activeFilters = topics.size + stacks.size + sources.size + (show !== 'all' ? 1 : 0) + (kind !== 'all' ? 1 : 0) + (format !== 'ALL' ? 1 : 0) + (within !== 'any' ? 1 : 0) + (search ? 1 : 0);
  const clearAll = () => {
    setSearch('');
    setKind('all');
    setShow('all');
    setTopics(new Set());
    setStacks(new Set());
    setSources(new Set());
    setFormat('ALL');
    setWithin('any');
  };

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

  if (discover.isPending) return <CardsSkeleton label={`Collecting hackathons from ${SOURCES.length} sites`} />;
  if (discover.isError) return <div className="page-error" role="alert">{discover.error.message}</div>;

  const failed = discover.data.sources.filter((s) => !s.ok);
  const count = (pred: (h: Listing) => boolean, skip: Skip) =>
    all.filter((h) => matches(h, skip) && pred(h)).length;
  const shownStacks = showAllStack ? stackOptions : stackOptions.slice(0, STACK_PREVIEW);

  return (
    <>
      <PageHead
        title="Discover"
        sub={`Open and upcoming hackathons from ${discover.data.sources.length} sites, plus Superteam Earn bounties. Adding one puts it in ${listName}.`}
      />

      {failed.length > 0 && <p className="form-error" role="status">{failed.map((s) => s.error).join(' ')} The other sources are shown.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="toolbar">
        <label className="search">
          <IconSearch />
          <input
            id="discover-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, description, city, tech"
            aria-label="Search hackathons"
          />
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

      <div className="foryou">
        <div className="segmented" role="group" aria-label="Show">
          <button type="button" className={!showForYou ? 'is-on' : ''} aria-pressed={!showForYou} onClick={() => setForYou(false)}>
            Everything <b>{all.length}</b>
          </button>
          <button type="button" className={showForYou ? 'is-on' : ''} aria-pressed={showForYou} onClick={() => setForYou(true)} disabled={!interests}>
            For you <b>{interests ? all.filter((h) => matchesInterests(h, interests)).length : 0}</b>
          </button>
        </div>
        <Link to="/app/settings?tab=discover" className="link">{interests ? 'Edit your interests' : 'Set your interests to get a For you list'}</Link>
      </div>

      <section className="panel discover-filters" aria-label="Filters">
        {all.some((h) => h.kind === 'bounty') && (
          <div className="filter-row">
            <span className="filter-label">Show</span>
            <div className="segmented" role="group" aria-label="Hackathons or bounties">
              {(['all', 'hackathon', 'bounty'] as Show[]).map((v) => (
                <button type="button" key={v} className={show === v ? 'is-on' : ''} aria-pressed={show === v} onClick={() => setShow(v)}>
                  {v === 'all' ? 'All' : v === 'hackathon' ? 'Hackathons' : 'Bounties'}{' '}
                  <b>{count((h) => v === 'all' || h.kind === v, 'show')}</b>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="filter-row">
          <span className="filter-label">Kind</span>
          <div className="segmented" role="group" aria-label="Kind">
            {(['all', 'web3', 'web2'] as Kind[]).map((k) => (
              <button type="button" key={k} className={kind === k ? 'is-on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {k === 'all' ? 'All' : k === 'web3' ? 'Web3' : 'Web2'}{' '}
                <b>{count((h) => k === 'all' || h.categories.includes('web3') === (k === 'web3'), 'kind')}</b>
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">Where</span>
          <div className="segmented" role="group" aria-label="Where">
            {(['ALL', ...FORMATS] as (Format | 'ALL')[]).map((f) => (
              <button type="button" key={f} className={format === f ? 'is-on' : ''} aria-pressed={format === f} onClick={() => setFormat(f)}>
                {f === 'ALL' ? 'All' : FORMAT_LABEL[f]}{' '}
                <b>{count((h) => f === 'ALL' || h.format === f, 'format')}</b>
              </button>
            ))}
          </div>
        </div>

        <ChipRow
          label="Topic"
          options={TOPICS.filter((t) => all.some((h) => h.categories.includes(t)))}
          selected={topics}
          onToggle={(t) => setTopics((s) => toggle(s, t))}
          render={(t) => CATEGORY_LABEL[t]}
          count={(t) => count((h) => h.categories.includes(t), 'topics')}
        />

        {stackOptions.length > 0 && (
          <div className="filter-row">
            <span className="filter-label">Tech stack</span>
            <div className="filter-chips" role="group" aria-label="Tech stack">
              {shownStacks.map((t) => (
                <button type="button" key={t} className={stacks.has(t) ? 'is-on' : ''} aria-pressed={stacks.has(t)} onClick={() => setStacks((s) => toggle(s, t))}>
                  {t} <b>{count((h) => h.stack.includes(t), 'stacks')}</b>
                </button>
              ))}
              {stackOptions.length > STACK_PREVIEW && (
                <button type="button" className="filter-more" onClick={() => setShowAllStack((v) => !v)}>
                  {showAllStack ? 'Show fewer' : `+${stackOptions.length - STACK_PREVIEW} more`}
                </button>
              )}
            </div>
          </div>
        )}

        <ChipRow
          label="Site"
          options={SOURCES.filter((src) => all.some((h) => h.source === src))}
          selected={sources}
          onToggle={(s) => setSources((set) => toggle(set, s))}
          render={(s) => SOURCE_LABEL[s]}
          count={(s) => count((h) => h.source === s, 'sources')}
        />

        <div className="filter-row filter-row-selects">
          <label className="sort">
            <span>Closes</span>
            <select id="discover-within" value={within} onChange={(e) => setWithin(e.target.value as Window)}>
              {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
          <span className="spacer" />
          <span className="filter-result" aria-live="polite">
            {rows.length} of {all.length}
          </span>
          {activeFilters > 0 && <button type="button" className="link" onClick={clearAll}>Clear all ({activeFilters})</button>}
        </div>
      </section>

      {rows.length ? (
        <div className="listings">
          {rows.map((h) => (
            <ListingCard key={h.id} h={h} now={now} match={Boolean(interests && matchesInterests(h, interests))} added={inList.has(linkKey(h.url))} busy={addingId === h.id} onAdd={() => add(h)} viewed={viewed.has(h.id)} onView={() => markViewed(h.id)} />
          ))}
        </div>
      ) : (
        <p className="no-match">
          Nothing matches these filters. <button type="button" className="link" onClick={clearAll}>Clear all</button>
        </p>
      )}
      <p className="hint discover-foot">
        Updated {formatMoment(discover.data.fetchedAt)}. Lists refresh every 30 minutes. Kind, topic and tech stack come from each event's
        description and tags, so check the event page before you commit.
      </p>
    </>
  );
}
