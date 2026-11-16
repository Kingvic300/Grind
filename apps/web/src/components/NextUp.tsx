import { Link } from 'react-router-dom';
import { Bone } from './Loading';
import { useHackathons, useNow } from '../lib/hooks';
import { countdown } from '../lib/time';
import type { Hackathon } from '../lib/types';

type Next = { hackathon: Hackathon; label: string; at: string };

/** The soonest open deadline in the current list. */
function nextDeadline(list: Hackathon[], now: number): Next | null {
  let best: Next | null = null;
  for (const h of list) {
    const options: Next[] = [];
    if (h.registrationDeadline && h.status === 'INTERESTED') options.push({ hackathon: h, label: 'registration', at: h.registrationDeadline });
    if (h.submissionDeadline && h.status !== 'SUBMITTED' && h.status !== 'DONE') options.push({ hackathon: h, label: 'submission', at: h.submissionDeadline });
    for (const o of options) {
      if (new Date(o.at).getTime() > now && (!best || o.at < best.at)) best = o;
    }
  }
  return best;
}

/** Sidebar widget: the next deadline as a live terminal-style countdown. */
export function NextUp({ onOpen }: { onOpen: (h: Hackathon) => void }) {
  const query = useHackathons();
  const now = useNow();
  const next = nextDeadline(query.data ?? [], now);

  if (query.isPending) {
    return (
      <div className="nextup" aria-hidden="true">
        <Bone className="sk-dark" style={{ width: '60%', height: 12 }} />
        <Bone className="sk-dark" style={{ width: '45%', height: 26, marginTop: 8 }} />
        <Bone className="sk-dark" style={{ width: '75%', height: 12, marginTop: 6 }} />
      </div>
    );
  }

  if (!next) {
    return (
      <div className="nextup">
        <p className="nextup-cmd"><b>&gt;</b> grind next</p>
        <p className="nextup-out">no open deadlines.</p>
        <Link to="/app/discover" className="nextup-link">Find a hackathon</Link>
      </div>
    );
  }

  const left = countdown(next.at, now);
  return (
    <button type="button" className="nextup" onClick={() => onOpen(next.hackathon)}>
      <span className="nextup-cmd"><b>&gt;</b> grind next</span>
      <span className="nextup-out">{next.label} closes in</span>
      <span className={`nextup-time${left.urgent ? ' is-urgent' : ''}`}>{left.text}</span>
      <span className="nextup-name">{next.hackathon.name}</span>
    </button>
  );
}
