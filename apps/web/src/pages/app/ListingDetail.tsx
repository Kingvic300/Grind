import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { IconChevronLeft } from '../../components/Icons';
import { Badges, DeadlineTag, ListingActions, ListingImage, nextClose, toDay, useAddListing } from '../../components/Listing';
import { Bone } from '../../components/Loading';
import { useDiscover, useMe, useNow } from '../../lib/hooks';
import { useViewedListings } from '../../lib/viewed';
import { formatMoment, formatRange } from '../../lib/time';
import { CATEGORY_LABEL, FORMAT_LABEL, SOURCE_LABEL, hasInterests, matchesInterests } from '../../lib/types';

/** Goes back to Discover the way the person came, so filters and scroll position stay. */
function BackLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromDiscover = Boolean((location.state as { fromDiscover?: boolean } | null)?.fromDiscover);
  return (
    <Link
      to="/app/discover"
      className="listing-back"
      onClick={(e) => {
        if (!fromDiscover) return;
        e.preventDefault();
        navigate(-1);
      }}
    >
      <IconChevronLeft /> Discover
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="listing-page" role="status" aria-live="polite">
      <span className="sr-only">Loading hackathon</span>
      <Bone className="sk-line" style={{ width: 90 }} />
      <div className="listing-hero">
        <Bone className="sk-img listing-hero-img" />
        <span className="sk-stack" style={{ flex: 1 }}>
          <Bone className="sk-line" style={{ width: 120 }} />
          <Bone className="sk-line" style={{ width: '70%', height: 28 }} />
          <Bone className="sk-line sk-faint" style={{ width: '40%' }} />
        </span>
      </div>
      <div className="listing-page-grid">
        <div className="panel">{Array.from({ length: 5 }, (_, i) => <Bone key={i} className="sk-line" style={{ width: `${95 - i * 8}%` }} />)}</div>
        <div className="panel">{Array.from({ length: 4 }, (_, i) => <Bone key={i} className="sk-row" />)}</div>
      </div>
    </div>
  );
}

/** Everything known about one Discover listing, so people can judge it without leaving Grind. */
export function ListingDetailPage() {
  const { id = '' } = useParams();
  const discover = useDiscover();
  const me = useMe();
  const now = useNow(60_000);
  const { markViewed } = useViewedListings();
  const { isAdded, add, addingId, error, ready } = useAddListing();
  const h = discover.data?.hackathons.find((l) => l.id === id);

  // Opening the page counts as viewing it, also when someone lands here from a shared link.
  useEffect(() => {
    if (h) markViewed(h.id);
  }, [h, markViewed]);

  useEffect(() => {
    if (!h) return;
    const before = document.title;
    document.title = `${h.name} · Grind`;
    return () => {
      document.title = before;
    };
  }, [h]);

  if (discover.isPending) return <DetailSkeleton />;
  if (discover.isError) return <div className="page-error" role="alert">{discover.error.message}</div>;
  if (!h) {
    return (
      <div className="listing-page">
        <BackLink />
        <div className="panel listing-gone">
          <h1>This hackathon is no longer listed</h1>
          <p>It may have closed, or its site took it down. Discover only shows open and upcoming events.</p>
          <Link to="/app/discover" className="btn btn-ink">Browse Discover</Link>
        </div>
      </div>
    );
  }

  const interests = me.data && hasInterests(me.data) ? me.data : null;
  const deadlines = [
    h.registrationDeadline && { label: 'Registration closes', at: h.registrationDeadline },
    h.submissionDeadline && { label: 'Submission closes', at: h.submissionDeadline },
  ].filter((d): d is { label: string; at: string } => Boolean(d));
  const topics = h.categories.filter((c) => c !== 'web3');
  const tags = h.tags.filter((t) => !h.stack.some((s) => s.toLowerCase() === t.toLowerCase()));
  const added = isAdded(h);

  return (
    <article className="listing-page">
      <BackLink />

      <header className="listing-hero">
        <span className="listing-hero-img"><ListingImage h={h} /></span>
        <div className="listing-head">
          <Badges h={h} match={Boolean(interests && matchesInterests(h, interests))} viewed={false} />
          <h1>{h.name}</h1>
          {h.organizer && <p className="listing-org">{h.organizer}</p>}
          <DeadlineTag closing={nextClose(h, now)} now={now} />
        </div>
      </header>

      <div className="listing-hero-actions">
        <ListingActions h={h} added={added} onAdd={() => add(h)} busy={addingId === h.id} disabled={!ready} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="listing-page-grid">
        <div className="listing-page-main">
          <section className="panel listing-about" aria-labelledby="listing-about">
            <h2 id="listing-about">About</h2>
            {h.description ? (
              <p className="listing-full-desc">{h.description}</p>
            ) : (
              <p className="hint">{SOURCE_LABEL[h.source]} does not share a description with Grind. Open the site to read it.</p>
            )}
          </section>

          {(topics.length > 0 || h.stack.length > 0 || tags.length > 0) && (
            <section className="panel listing-about" aria-labelledby="listing-topics">
              <h2 id="listing-topics">Topics and tech</h2>
              {topics.length > 0 && (
                <div className="listing-chip-group">
                  <h3>Topics</h3>
                  <span className="chips">{topics.map((c) => <span className="chip chip-topic" key={c}>{CATEGORY_LABEL[c]}</span>)}</span>
                </div>
              )}
              {h.stack.length > 0 && (
                <div className="listing-chip-group">
                  <h3>Tech stack</h3>
                  <span className="chips">{h.stack.map((t) => <span className="chip chip-stack" key={t}>{t}</span>)}</span>
                </div>
              )}
              {tags.length > 0 && (
                <div className="listing-chip-group">
                  <h3>Tags</h3>
                  <span className="chips">{tags.map((t) => <span className="chip" key={t}>{t}</span>)}</span>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="panel listing-side" aria-label="Key facts">
          <dl className="listing-facts">
            <div>
              <dt>Dates</dt>
              <dd>{formatRange(toDay(h.startDate), toDay(h.endDate))}</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{h.location ?? FORMAT_LABEL[h.format]}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{FORMAT_LABEL[h.format]}</dd>
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
            <div>
              <dt>Listed on</dt>
              <dd>{SOURCE_LABEL[h.source]}{h.kind === 'bounty' ? ' (bounty)' : ''}</dd>
            </div>
          </dl>
          <p className="hint">Updated {formatMoment(discover.data.fetchedAt)}. Check the event page before you commit.</p>
        </aside>
      </div>
    </article>
  );
}
