import { useMemo, useState } from 'react';
import { useHackathons, useSaveHackathon } from '../lib/hooks';
import { formatMoment } from '../lib/time';
import { SOURCE_LABEL, type HackathonInput, type Listing } from '../lib/types';
import { IconCheck, IconExternal, IconPlus } from './Icons';
import { Spinner } from './Loading';

export const DAY = 24 * 60 * 60 * 1000;

/** Same link with or without scheme, www, query or trailing slash. Keep in step with the API. */
export const linkKey = (url: string) =>
  url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

/** Names match when they differ only in case and spacing. Keep in step with the API. */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const toDay = (day: string | null) => (day ? `${day}T00:00:00.000Z` : null);

/** Where a listing's details page lives. Ids hold ":" and "/", so they are encoded. */
export const listingPath = (id: string) => `/app/discover/${encodeURIComponent(id)}`;

export type Closing = { label: string; at: number };

/** The next thing that closes: registration, submission, or the event itself. */
export function nextClose(h: Listing, now: number): Closing | null {
  const options: Closing[] = [];
  if (h.registrationDeadline) options.push({ label: 'Registration closes', at: Date.parse(h.registrationDeadline) });
  if (h.submissionDeadline) options.push({ label: 'Submission closes', at: Date.parse(h.submissionDeadline) });
  if (h.endDate) options.push({ label: 'Ends', at: Date.parse(`${h.endDate}T23:59:59Z`) });
  return options.filter((o) => o.at > now).sort((a, b) => a.at - b.at)[0] ?? null;
}

/** "5 hours", "2 days", "3 weeks", "2 months". */
export function relative(ms: number): string {
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

/**
 * Adds Discover listings to the current list. A listing counts as added when its link or its name
 * is already in the list, the same rule the API uses to refuse duplicates.
 */
export function useAddListing() {
  const mine = useHackathons();
  const save = useSaveHackathon();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const taken = useMemo(() => {
    const rows = mine.data ?? [];
    return {
      links: new Set(rows.flatMap((h) => (h.url ? [linkKey(h.url)] : []))),
      names: new Set(rows.map((h) => nameKey(h.name))),
    };
  }, [mine.data]);

  const isAdded = (h: Listing) => taken.links.has(linkKey(h.url)) || taken.names.has(nameKey(h.name.slice(0, 120)));

  const add = (h: Listing) => {
    if (addingId || isAdded(h)) return;
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

  return { isAdded, add, addingId, error, ready: !mine.isPending };
}

export function DeadlineTag({ closing, now }: { closing: Closing | null; now: number }) {
  if (!closing) return null;
  const left = closing.at - now;
  const tone = left <= 3 * DAY ? 'hot' : left <= 14 * DAY ? 'warm' : 'calm';
  return (
    <span className={`due due-${tone}`} title={formatMoment(new Date(closing.at).toISOString())}>
      {closing.label} in {relative(left)}
    </span>
  );
}

export function Badges({ h, match, viewed }: { h: Listing; match: boolean; viewed: boolean }) {
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

export function ListingImage({ h }: { h: Listing }) {
  // Some sources serve broken or blocked images. Show the initial instead of an empty box.
  const [broken, setBroken] = useState(false);
  return h.imageUrl && !broken ? (
    <img src={h.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  ) : (
    <span className="listing-img-empty" aria-hidden="true">{h.name.slice(0, 1)}</span>
  );
}

type ActionsProps = { h: Listing; added: boolean; onAdd: () => void; busy: boolean; disabled?: boolean; onOpenSite?: () => void };

export function ListingActions({ h, added, onAdd, busy, disabled, onOpenSite }: ActionsProps) {
  return (
    <>
      {added ? (
        <span className="listing-added"><IconCheck /> In this list</span>
      ) : (
        <button type="button" className="btn btn-ink" onClick={onAdd} disabled={busy || disabled}>
          {busy ? <Spinner /> : <IconPlus />} {busy ? 'Adding' : 'Add to list'}
        </button>
      )}
      <a className="btn btn-quiet" href={h.url} target="_blank" rel="noopener noreferrer" onClick={onOpenSite} onAuxClick={onOpenSite}>
        Open site <IconExternal />
      </a>
    </>
  );
}
