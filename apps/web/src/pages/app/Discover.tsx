import { useEffect, useMemo } from 'react';
import { Link, useNavigationType } from 'react-router-dom';
import { PageHead } from '../../components/AppShell';
import { IconSearch } from '../../components/Icons';
import {
  Badges,
  DAY,
  DeadlineTag,
  ListingActions,
  ListingImage,
  listingPath,
  nextClose,
  toDay,
  useAddListing,
} from '../../components/Listing';
import { CardsSkeleton } from '../../components/Loading';
import { useDiscover, useMe, useNow, useSpaces } from '../../lib/hooks';
import { scrollMemory, useRemembered } from '../../lib/remember';
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

const WINDOWS: { value: Window; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '3', label: 'In 3 days' },
  { value: '7', label: 'In a week' },
  { value: '30', label: 'In a month' },
  { value: '90', label: 'In 3 months' },
];

const toggle = <T,>(set: Set<T>, value: T) => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

type CardProps = { h: Listing; added: boolean; onAdd: () => void; busy: boolean; ready: boolean; now: number; match: boolean; viewed: boolean; onView: () => void };

/** The whole card opens the listing's details page. Buttons inside it keep working on their own. */
function ListingCard({ h, added, onAdd, busy, ready, now, match, viewed, onView }: CardProps) {
  const open = () => {
    scrollMemory.save('discover');
    onView();
  };
  return (
    <article className={`listing is-link${viewed ? ' is-viewed' : ''}`}>
      <div className="listing-top">
        <ListingImage h={h} />
        <div className="listing-head">
          <Badges h={h} match={match} viewed={viewed} />
          <h2>
            <Link to={listingPath(h.id)} state={{ fromDiscover: true }} className="listing-title" onClick={open}>{h.name}</Link>
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
      {h.prize && <p className="listing-prize">{h.prize}</p>}

      {(h.categories.length > 0 || h.stack.length > 0) && (
        <span className="chips">
          {h.categories.filter((c) => c !== 'web3').slice(0, 3).map((c) => <span className="chip chip-topic" key={c}>{CATEGORY_LABEL[c]}</span>)}
          {h.stack.slice(0, 4).map((t) => <span className="chip chip-stack" key={t}>{t}</span>)}
        </span>
      )}

      <div className="listing-actions">
        <ListingActions h={h} added={added} onAdd={onAdd} busy={busy} disabled={!ready} onOpenSite={onView} />
      </div>
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
  const [forYou, setForYou] = useRemembered<boolean | null>('discover.forYou', null);
  const showForYou = forYou ?? Boolean(interests);
  const spaces = useSpaces();
  const { spaceId } = useSpaceId();
  const { isAdded, add, addingId, error, ready } = useAddListing();
  const { viewed, markViewed } = useViewedListings();
  const now = useNow(60_000);
  const navigation = useNavigationType();
  // Filters stay put while someone reads a listing's details page and comes back.
  const [search, setSearch] = useRemembered('discover.search', '');
  const [kind, setKind] = useRemembered<Kind>('discover.kind', 'all');
  const [show, setShow] = useRemembered<Show>('discover.show', 'all');
  const [topics, setTopics] = useRemembered<Set<Category>>('discover.topics', new Set());
  const [stacks, setStacks] = useRemembered<Set<string>>('discover.stacks', new Set());
  const [sources, setSources] = useRemembered<Set<Source>>('discover.sources', new Set());
  const [format, setFormat] = useRemembered<Format | 'ALL'>('discover.format', 'ALL');
  const [within, setWithin] = useRemembered<Window>('discover.within', 'any');
  const [sort, setSort] = useRemembered<Sort>('discover.sort', 'closing');
  const [showAllStack, setShowAllStack] = useRemembered('discover.showAllStack', false);
  // Listings viewed when "Hide viewed" was turned on. A snapshot, so a card opened
  // afterwards stays put instead of vanishing when someone comes back from its page.
  const [hidden, setHidden] = useRemembered<Set<string> | null>('discover.hidden', null);

  const listName = spaceId ? (spaces.data?.find((s) => s.id === spaceId)?.name ?? 'team') : 'My hackathons';
  const all = useMemo(() => discover.data?.hackathons ?? [], [discover.data]);

  // Back from a details page: return to the card that was opened.
  const loaded = Boolean(discover.data);
  useEffect(() => {
    if (!loaded) return;
    const y = scrollMemory.take('discover');
    if (y !== null && navigation === 'POP') window.scrollTo(0, y);
  }, [loaded, navigation]);

  const stackOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of all) for (const t of h.stack) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [all]);

  // Every filter except the one being counted, so chip counts show what clicking would give.
  const matches = (h: Listing, skip?: Skip) => {
    if (showForYou && interests && !matchesInterests(h, interests)) return false;
    if (hidden?.has(h.id)) return false;
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

  const activeFilters = topics.size + stacks.size + sources.size + (show !== 'all' ? 1 : 0) + (kind !== 'all' ? 1 : 0) + (format !== 'ALL' ? 1 : 0) + (within !== 'any' ? 1 : 0) + (search ? 1 : 0) + (hidden ? 1 : 0);
  const clearAll = () => {
    setSearch('');
    setKind('all');
    setShow('all');
    setTopics(new Set());
    setStacks(new Set());
    setSources(new Set());
    setFormat('ALL');
    setWithin('any');
    setHidden(null);
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
          <label className="check hide-viewed">
            <input
              type="checkbox"
              checked={hidden !== null}
              onChange={(e) => setHidden(e.target.checked ? new Set(viewed) : null)}
              disabled={!hidden && !all.some((h) => viewed.has(h.id))}
            />
            Hide viewed <b>{all.filter((h) => viewed.has(h.id)).length}</b>
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
            <ListingCard
              key={h.id}
              h={h}
              now={now}
              match={Boolean(interests && matchesInterests(h, interests))}
              added={isAdded(h)}
              busy={addingId === h.id}
              ready={ready}
              onAdd={() => add(h)}
              viewed={viewed.has(h.id)}
              onView={() => markViewed(h.id)}
            />
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
