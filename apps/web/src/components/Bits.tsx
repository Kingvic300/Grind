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
