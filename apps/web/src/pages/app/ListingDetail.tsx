import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { IconChevronLeft } from '../../components/Icons';
import { Badges, DAY, ListingActions, ListingImage, nextClose, relative, toDay, useAddListing } from '../../components/Listing';
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
      <div className="lp-hero lp-hero-sk">
        <div className="lp-hero-top">
          <Bone className="sk-img lp-logo-sk" />
          <span className="sk-stack" style={{ flex: 1 }}>
            <Bone className="sk-line" style={{ width: 120 }} />
            <Bone className="sk-line" style={{ width: '60%', height: 32 }} />
            <Bone className="sk-line sk-faint" style={{ width: '40%' }} />
          </span>
        </div>
      </div>
      <div className="lp-grid">
        <div className="panel">{Array.from({ length: 6 }, (_, i) => <Bone key={i} className="sk-line" style={{ width: `${95 - i * 8}%` }} />)}</div>
        <div className="panel">{Array.from({ length: 4 }, (_, i) => <Bone key={i} className="sk-row" />)}</div>
      </div>
    </div>
  );
}

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'label'; label: string; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'para'; text: string };

const BULLET = /^([-*•·▪►✓✔]|\d{1,2}[.)])\s+/;

/** A short line with no closing punctuation, like "Core Domains" or "Prizes:". */
const isHeading = (line: string) =>
  line.length <= 60 && /^[A-Z0-9]/.test(line) && line.split(/\s+/).length <= 6 && (/:$/.test(line) || !/[.!?,;:)\]]$/.test(line));

/** A short one-line item, like "AgroTech (SDG 2, 12, 13, 15)". Runs of these read best as a list. */
const isItem = (line: string) => line.length <= 90 && !/[.!?]$/.test(line);

/**
 * Turns the plain-text description sources send into readable blocks: headings, "Label: value"
 * lines, bullet lists, and paragraphs. Nothing is dropped, only regrouped.
 */
function toBlocks(text: string): Block[] {
  const chunks = text.replace(/\r/g, '').split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
  const blocks: Block[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) blocks.push({ kind: 'list', items: run });
    else run.forEach((t) => blocks.push({ kind: 'para', text: t }));
    run = [];
  };

  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every((l) => BULLET.test(l))) {
      flush();
      blocks.push({ kind: 'list', items: lines.map((l) => l.replace(BULLET, '')) });
      continue;
    }
    if (lines.length === 1) {
      const line = lines[0];
      if (BULLET.test(line)) {
        run.push(line.replace(BULLET, ''));
        continue;
      }
      if (isHeading(line)) {
        flush();
        blocks.push({ kind: 'heading', text: line.replace(/:$/, '') });
        continue;
      }
      const label = line.match(/^([^:]{2,32}):\s+(.+)$/);
      if (label && !/https?$/i.test(label[1])) {
        flush();
        blocks.push({ kind: 'label', label: label[1], text: label[2] });
        continue;
      }
      if (isItem(line)) {
        run.push(line);
        continue;
      }
    }
    flush();
    blocks.push({ kind: 'para', text: chunk });
  }
  flush();
  return blocks;
}

const LONG = 1400;

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(text.length <= LONG);
  const blocks = toBlocks(text);
  return (
    <>
      <div className={`lp-desc${open ? '' : ' is-clamped'}`}>
        {blocks.map((b, i) => {
          if (b.kind === 'heading') return <h3 key={i}>{b.text}</h3>;
          if (b.kind === 'label') return <p key={i}><strong>{b.label}:</strong> {b.text}</p>;
          if (b.kind === 'list') return <ul key={i}>{b.items.map((item, j) => <li key={j}>{item}</li>)}</ul>;
          return <p key={i}>{b.text}</p>;
        })}
      </div>
      {!open && (
        <button type="button" className="btn btn-outline btn-sm lp-more" onClick={() => setOpen(true)}>
          Show full description
        </button>
      )}
    </>
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
  const closing = nextClose(h, now);
  const left = closing ? closing.at - now : 0;
  const tone = left <= 3 * DAY ? 'hot' : left <= 14 * DAY ? 'warm' : 'calm';

  return (
    <article className="listing-page">
      <BackLink />

      <header className="lp-hero">
        <div className="lp-hero-top">
          <span className="lp-logo"><ListingImage h={h} /></span>
          <div className="lp-head">
            <Badges h={h} match={Boolean(interests && matchesInterests(h, interests))} viewed={false} />
            <h1>{h.name}</h1>
            {h.organizer && <p className="lp-org">{h.organizer}</p>}
          </div>
        </div>
        <dl className="lp-stats">
          <div>
            <dt>Dates</dt>
            <dd>{formatRange(toDay(h.startDate), toDay(h.endDate))}</dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{h.location ?? FORMAT_LABEL[h.format]}</dd>
          </div>
          {h.prize && (
            <div>
              <dt>Prizes</dt>
              <dd className="lp-prize">{h.prize}</dd>
            </div>
          )}
        </dl>
      </header>

      <div className="lp-grid">
        <aside className="lp-side" aria-label="Key facts">
          <div className="panel lp-cta">
            {closing && (
              <div className={`lp-countdown lp-countdown-${tone}`}>
                <span>{closing.label} in</span>
                <strong>{relative(left)}</strong>
                <time dateTime={new Date(closing.at).toISOString()}>{formatMoment(new Date(closing.at).toISOString())}</time>
              </div>
            )}
            <div className="lp-actions">
              <ListingActions h={h} added={added} onAdd={() => add(h)} busy={addingId === h.id} disabled={!ready} />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>

          <div className="panel">
            <dl className="listing-facts">
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
              <div>
                <dt>Listed on</dt>
                <dd>{SOURCE_LABEL[h.source]}{h.kind === 'bounty' ? ' (bounty)' : ''}</dd>
              </div>
            </dl>
            <p className="hint lp-updated">Updated {formatMoment(discover.data.fetchedAt)}. Check the event page before you commit.</p>
          </div>
        </aside>

        <div className="lp-main">
          <section className="panel lp-section" aria-labelledby="listing-about">
            <h2 id="listing-about">About</h2>
            {h.description ? (
              <Description text={h.description} />
            ) : (
              <p className="hint">{SOURCE_LABEL[h.source]} does not share a description with Grind. Open the site to read it.</p>
            )}
          </section>

          {(topics.length > 0 || h.stack.length > 0 || tags.length > 0) && (
            <section className="panel lp-section" aria-labelledby="listing-topics">
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
      </div>
    </article>
  );
}
