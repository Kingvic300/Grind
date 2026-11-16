import { IconExternal } from './Icons';
import { useNow } from '../lib/hooks';
import { countdown } from '../lib/time';
import { STATUS_LABEL, type Status } from '../lib/types';

export function StatusPill({ status }: { status: Status }) {
  return <span className={`pill pill-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

/** A live countdown to a deadline. Turns urgent inside 24 hours. */
export function Countdown({ iso, prefix }: { iso: string; prefix?: string }) {
  const now = useNow();
  const { text, urgent, closed } = countdown(iso, now);
  return (
    <span className={`countdown${urgent ? ' is-urgent' : ''}${closed ? ' is-closed' : ''}`}>
      {prefix && !closed ? `${prefix} ` : ''}
      <span className="countdown-digits">{text}</span>
    </span>
  );
}

/** "Everyone / Assigned to me" switch, shown on team lists. */
export function MineToggle({ mine, onChange, count }: { mine: boolean; onChange: (mine: boolean) => void; count: number }) {
  return (
    <div className="segmented" role="group" aria-label="Whose hackathons">
      <button type="button" className={!mine ? 'is-on' : ''} aria-pressed={!mine} onClick={() => onChange(false)}>Everyone</button>
      <button type="button" className={mine ? 'is-on' : ''} aria-pressed={mine} onClick={() => onChange(true)}>
        Assigned to me <b>{count}</b>
      </button>
    </div>
  );
}

/** Where "Open" goes: the saved link, or a web search when no link is saved yet. */
export function hackathonHref(h: { name: string; url: string | null }) {
  if (h.url) return /^https?:\/\//i.test(h.url) ? h.url : `https://${h.url}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${h.name} hackathon`)}`;
}

/** Opens the hackathon's site in a new tab. Stops the click so table rows do not also open the editor. */
export function OpenSite({ h, className = 'open-site' }: { h: { name: string; url: string | null }; className?: string }) {
  return (
    <a
      className={className}
      href={hackathonHref(h)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={h.url ? `Open ${h.name} site` : `No link saved. Search the web for ${h.name}`}
    >
      {h.url ? 'Open' : 'Find'}<IconExternal />
    </a>
  );
}
