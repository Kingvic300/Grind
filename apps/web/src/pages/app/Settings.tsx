import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { IconCheck, IconLink } from '../../components/Icons';
import { Bone, Spinner } from '../../components/Loading';
import { Faces } from '../../components/SpaceSwitcher';
import { API_URL } from '../../lib/api';
import { useAuthActions, useCalendarFeed, useDiscover, useHackathons, useMe, useSpaces, useStats } from '../../lib/hooks';
import { useSpaceId } from '../../lib/space';
import { formatClock, money } from '../../lib/time';
import {
  AVATAR_COLORS,
  CATEGORY_LABEL,
  FORMATS,
  FORMAT_LABEL,
  STACK_NAMES,
  matchesInterests,
  type Category,
  type User,
  type UserUpdate,
} from '../../lib/types';

const TABS = [
  { id: 'profile', label: 'Profile', hint: 'Photo, bio, links' },
  { id: 'notifications', label: 'Notifications', hint: 'Emails and calendar' },
  { id: 'discover', label: 'Discover', hint: 'Your interests' },
  { id: 'preferences', label: 'Preferences', hint: 'Lists, week, clock' },
  { id: 'lists', label: 'Teams', hint: 'Where you belong' },
  { id: 'security', label: 'Security', hint: 'Password, devices' },
  { id: 'data', label: 'Your data', hint: 'Export, delete' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const TOPICS = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => c !== 'web3');
const memberSince = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

type Status = { ok: boolean; text: string } | null;

/** One running action per section, so only the clicked button spins, plus its result message. */
function useAction() {
  const [working, setWorking] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const run = async (key: string, work: () => Promise<unknown>, done?: string) => {
    setWorking(key);
    setStatus(null);
    try {
      await work();
      if (done) setStatus({ ok: true, text: done });
      return true;
    } catch (error) {
      setStatus({ ok: false, text: (error as Error).message });
      return false;
    } finally {
      setWorking(null);
    }
  };
  return { working, status, run, busy: working !== null, spin: (key: string) => (working === key ? <Spinner /> : null) };
}

function Message({ status }: { status: Status }) {
  if (!status) return null;
  return <p className={status.ok ? 'form-ok' : 'form-error'} role="status">{status.text}</p>;
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="set-section">
      <header>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </header>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, disabled, title, sub, busy }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; title: string; sub?: string; busy?: boolean }) {
  return (
    <label className={`switch${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true" />
      <span>
        <strong>{title} {busy && <Spinner />}</strong>
        {sub && <span>{sub}</span>}
      </span>
    </label>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.value} className={value === o.value ? 'is-on' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Crops the picked image to a centred square and shrinks it to 256px JPEG. */
function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Pick an image file.'));
    if (file.size > 15_000_000) return reject(new Error('That image is over 15 MB. Pick a smaller one.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Your browser could not read that image.'));
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Your browser could not read that image.'));
    };
    img.src = url;
  });
}

function download(name: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ---------- Header ----------

function Header({ me }: { me: User }) {
  const stats = useStats();
  const actions = useAuthActions();
  const file = useRef<HTMLInputElement>(null);
  const photo = useAction();

  const pick = async (f: File | undefined) => {
    if (!f) return;
    await photo.run('upload', async () => actions.updateProfile({ avatarUrl: await resizePhoto(f) }), 'Photo updated');
    if (file.current) file.current.value = '';
  };

  const tiles: [string, ReactNode][] = stats.data
    ? [
        ['Tracked', stats.data.tracked],
        ['Submitted', stats.data.submitted],
        ['Wins', stats.data.wins],
        ['Prize money', money(stats.data.prizeMoney)],
        ['Teams', stats.data.sharedLists],
      ]
    : [];

  return (
    <section className="set-hero">
      <div className="set-hero-id">
        <div className="set-photo">
          <Avatar person={me} size={88} />
          <button type="button" className="set-photo-btn" onClick={() => file.current?.click()} disabled={photo.busy} aria-label="Change photo">
            {photo.working ? <Spinner /> : 'Edit'}
          </button>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        </div>
        <div className="set-hero-text">
          <p className="set-cmd"><b>&gt;</b> grind whoami</p>
          <h1>{me.name}</h1>
          <p>{me.email} · Member since {memberSince.format(new Date(me.createdAt))}</p>
          {me.avatarUrl && (
            <button type="button" className="set-hero-link" disabled={photo.busy} onClick={() => photo.run('remove', () => actions.updateProfile({ avatarUrl: null }), 'Photo removed')}>
              {photo.spin('remove')}Remove photo
            </button>
          )}
        </div>
      </div>
      <dl className="set-stats">
        {stats.isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i}>
                <dt><Bone className="sk-dark" style={{ width: 60, height: 10 }} /></dt>
                <dd><Bone className="sk-dark" style={{ width: 40, height: 24, marginTop: 6 }} /></dd>
              </div>
            ))
          : tiles.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
      </dl>
      {photo.status && !photo.status.ok && <p className="set-hero-error" role="alert">{photo.status.text}</p>}
    </section>
  );
}

// ---------- Tabs ----------

function ProfileTab({ me }: { me: User }) {
  const actions = useAuthActions();
  const a = useAction();
  const [form, setForm] = useState({
    name: me.name,
    bio: me.bio ?? '',
    skills: me.skills.join(', '),
    githubUrl: me.githubUrl ?? '',
    linkedinUrl: me.linkedinUrl ?? '',
    websiteUrl: me.websiteUrl ?? '',
    xUrl: me.xUrl ?? '',
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const changes = useMemo(() => {
    const next: UserUpdate = {};
    if (form.name.trim() !== me.name) next.name = form.name.trim();
    if (form.bio.trim() !== (me.bio ?? '')) next.bio = form.bio.trim() || null;
    const skills = [...new Set(form.skills.split(',').map((s) => s.trim()).filter(Boolean))];
    if (skills.join('|') !== me.skills.join('|')) next.skills = skills;
    for (const key of ['githubUrl', 'linkedinUrl', 'websiteUrl', 'xUrl'] as const) {
      if (form[key].trim() !== (me[key] ?? '')) next[key] = form[key].trim() || null;
    }
    return next;
  }, [form, me]);
  const dirty = Object.keys(changes).length > 0;

  const save = (e: FormEvent) => {
    e.preventDefault();
    void a.run('save', () => actions.updateProfile(changes), 'Profile saved');
  };

  return (
    <>
      <Section title="Profile" sub="Your teammates see your photo, bio, skills and links.">
        <form className="set-form" onSubmit={save}>
          <div className="field-row">
            <label className="field" htmlFor="p-name">
              <span>Name</span>
              <input id="p-name" value={form.name} onChange={set('name')} required maxLength={80} autoComplete="name" />
            </label>
            <label className="field" htmlFor="p-email">
              <span>Email</span>
              <input id="p-email" value={me.email} readOnly />
            </label>
          </div>
          <label className="field" htmlFor="p-bio">
            <span>Bio</span>
            <textarea id="p-bio" value={form.bio} onChange={set('bio')} rows={3} maxLength={280} placeholder="Full stack dev. Into climate tech and late-night demos." />
            <small>{280 - form.bio.length} characters left</small>
          </label>
          <label className="field" htmlFor="p-skills">
            <span>Skills</span>
            <input id="p-skills" value={form.skills} onChange={set('skills')} placeholder="React, Solidity, Figma" />
            <small>Separate with commas.</small>
          </label>
          {form.skills.trim() && (
            <span className="chips">
              {[...new Set(form.skills.split(',').map((s) => s.trim()).filter(Boolean))].map((s) => <span className="chip" key={s}>{s}</span>)}
            </span>
          )}
          <div className="field-row">
            <label className="field" htmlFor="p-github"><span>GitHub</span><input id="p-github" value={form.githubUrl} onChange={set('githubUrl')} inputMode="url" placeholder="github.com/you" /></label>
            <label className="field" htmlFor="p-linkedin"><span>LinkedIn</span><input id="p-linkedin" value={form.linkedinUrl} onChange={set('linkedinUrl')} inputMode="url" placeholder="linkedin.com/in/you" /></label>
          </div>
          <div className="field-row">
            <label className="field" htmlFor="p-website"><span>Website</span><input id="p-website" value={form.websiteUrl} onChange={set('websiteUrl')} inputMode="url" placeholder="you.dev" /></label>
            <label className="field" htmlFor="p-x"><span>X</span><input id="p-x" value={form.xUrl} onChange={set('xUrl')} inputMode="url" placeholder="x.com/you" /></label>
          </div>
          <Message status={a.status} />
          <div className="set-actions">
            <button type="submit" className="btn btn-ink" disabled={a.busy || !dirty || !form.name.trim()}>{a.spin('save')}Save profile</button>
          </div>
        </form>
      </Section>

      <Section title="Avatar colour" sub="Used when you have no photo.">
        <AvatarColors me={me} />
      </Section>
    </>
  );
}

function AvatarColors({ me }: { me: User }) {
  const actions = useAuthActions();
  const a = useAction();
  const current = me.avatarColor ?? 'ember';
  return (
    <>
      <div className="swatches" role="radiogroup" aria-label="Avatar colour">
        {AVATAR_COLORS.map((c) => (
          <button
            type="button"
            key={c}
            role="radio"
            aria-checked={current === c}
            aria-label={c}
            className={`swatch avatar-${c}${current === c ? ' is-on' : ''}`}
            disabled={a.busy}
            onClick={() => a.run(c, () => actions.updateProfile({ avatarColor: c }))}
          >
            {a.working === c ? <Spinner /> : current === c ? <IconCheck /> : me.name.slice(0, 1).toUpperCase()}
          </button>
        ))}
      </div>
      <Message status={a.status} />
    </>
  );
}

function NotificationsTab({ me }: { me: User }) {
  const actions = useAuthActions();
  const a = useAction();
  const toggle = (key: keyof UserUpdate, on: boolean, text: string) => a.run(key, () => actions.updateProfile({ [key]: on }), text);
  const off = !me.emailReminders;

  return (
    <>
      <Section title="Deadline emails" sub={`Sent to ${me.email}. In teams every member gets their own.`}>
        <div className="set-toggles">
          <Toggle checked={me.emailReminders} busy={a.working === 'emailReminders'} disabled={a.busy} onChange={(v) => toggle('emailReminders', v, v ? 'Deadline emails on' : 'Deadline emails off')} title="Email me before deadlines" sub="Master switch for the three reminders below." />
          <div className={`set-sub${off ? ' is-off' : ''}`}>
            <Toggle checked={me.remindSubmission3d} busy={a.working === 'remindSubmission3d'} disabled={off || a.busy} onChange={(v) => toggle('remindSubmission3d', v, 'Saved')} title="3 days before submission closes" />
            <Toggle checked={me.remindSubmission1d} busy={a.working === 'remindSubmission1d'} disabled={off || a.busy} onChange={(v) => toggle('remindSubmission1d', v, 'Saved')} title="1 day before submission closes" />
            <Toggle checked={me.remindRegistration1d} busy={a.working === 'remindRegistration1d'} disabled={off || a.busy} onChange={(v) => toggle('remindRegistration1d', v, 'Saved')} title="1 day before registration closes" sub="Only while the hackathon is still marked Interested." />
          </div>
        </div>
      </Section>

      <Section title="Weekly digest" sub="Monday morning: deadlines in the next 7 days, plus up to 5 new Discover hackathons that match your interests.">
        <Toggle checked={me.weeklyDigest} busy={a.working === 'weeklyDigest'} disabled={a.busy} onChange={(v) => toggle('weeklyDigest', v, v ? 'Weekly digest on' : 'Weekly digest off')} title="Send me the weekly digest" />
        {me.weeklyDigest && !me.interestTopics.length && !me.interestStack.length && me.interestKind === 'any' && (
          <p className="hint">Tip: <Link to="/app/settings?tab=discover" className="link">set your interests</Link> so the digest can suggest hackathons.</p>
        )}
      </Section>
      <Message status={a.status} />

      <CalendarFeed />
    </>
  );
}

function CalendarFeed() {
  const feed = useCalendarFeed();
  const a = useAction();
  const token = feed.query.data?.token ?? null;
  const httpsUrl = token ? `${API_URL || window.location.origin}/api/calendar/${token}.ics` : '';
  const webcal = httpsUrl.replace(/^https?:/, 'webcal:');

  return (
    <Section title="Calendar feed" sub="Subscribe in Google Calendar, Apple Calendar or Outlook. Event days and deadlines from all your lists, with alerts before deadlines.">
      {feed.query.isPending ? (
        <Bone className="sk-row" />
      ) : token ? (
        <div className="set-form">
          <div className="invite-row">
            <input value={httpsUrl} readOnly aria-label="Calendar feed link" onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn btn-ink"
              disabled={a.busy}
              onClick={() => a.run('copy', async () => {
                try { await navigator.clipboard.writeText(httpsUrl); } catch { throw new Error('Copy did not work here. Select the link and copy it by hand.'); }
              }, 'Link copied. In your calendar app, add a calendar from URL and paste it.')}
            >
              {a.working === 'copy' ? <Spinner /> : <IconLink />} Copy
            </button>
          </div>
          <p className="hint">Keep this link private: anyone who has it can see your hackathon dates.</p>
          <div className="set-actions">
            <a className="btn btn-outline" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
            <a className="btn btn-outline" href={webcal}>Open in Apple Calendar</a>
            <span className="spacer" />
            <button type="button" className="btn btn-quiet" disabled={a.busy} onClick={() => a.run('rotate', feed.rotate, 'New link made. The old link no longer works.')}>{a.spin('rotate')}New link</button>
            <button type="button" className="btn btn-quiet btn-danger-text" disabled={a.busy} onClick={() => a.run('off', feed.disable, 'Calendar feed turned off.')}>{a.spin('off')}Turn off</button>
          </div>
        </div>
      ) : (
        <div className="set-actions">
          <button type="button" className="btn btn-ink" disabled={a.busy} onClick={() => a.run('on', feed.rotate, 'Calendar feed on.')}>{a.spin('on')}Turn on calendar feed</button>
        </div>
      )}
      <Message status={a.status} />
    </Section>
  );
}

function DiscoverTab({ me }: { me: User }) {
  const actions = useAuthActions();
  const discover = useDiscover();
  const a = useAction();
  const [kind, setKind] = useState(me.interestKind);
  const [topics, setTopics] = useState(new Set(me.interestTopics));
  const [stack, setStack] = useState(new Set(me.interestStack));
  const [format, setFormat] = useState<string>(me.interestFormat ?? '');
  const [showAll, setShowAll] = useState(false);

  const draft = { interestKind: kind, interestTopics: [...topics], interestStack: [...stack], interestFormat: (format || null) as User['interestFormat'] };
  const dirty =
    kind !== me.interestKind ||
    draft.interestTopics.sort().join() !== [...me.interestTopics].sort().join() ||
    draft.interestStack.sort().join() !== [...me.interestStack].sort().join() ||
    (format || null) !== me.interestFormat;
  const matching = discover.data?.hackathons.filter((h) => matchesInterests(h, draft)).length;
  const flip = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };
  const stackShown = showAll ? STACK_NAMES : STACK_NAMES.slice(0, 18);

  return (
    <Section title="Discover interests" sub="Discover opens on a For you list built from these, marks matches, and the weekly digest suggests them.">
      <div className="set-form">
        <div className="filter-row">
          <span className="filter-label">Kind</span>
          <Segmented label="Kind" value={kind} onChange={setKind} options={[{ value: 'any', label: 'Any' }, { value: 'web3', label: 'Web3' }, { value: 'web2', label: 'Web2' }]} />
        </div>
        <div className="filter-row">
          <span className="filter-label">Topics</span>
          <div className="filter-chips">
            {TOPICS.map((t) => (
              <button type="button" key={t} className={topics.has(t) ? 'is-on' : ''} aria-pressed={topics.has(t)} onClick={() => setTopics((s) => flip(s, t))}>{CATEGORY_LABEL[t]}</button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">Tech stack</span>
          <div className="filter-chips">
            {stackShown.map((t) => (
              <button type="button" key={t} className={stack.has(t) ? 'is-on' : ''} aria-pressed={stack.has(t)} onClick={() => setStack((s) => flip(s, t))}>{t}</button>
            ))}
            <button type="button" className="filter-more" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show fewer' : `+${STACK_NAMES.length - 18} more`}</button>
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">Format</span>
          <Segmented label="Format" value={format} onChange={setFormat} options={[{ value: '', label: 'Any' }, ...FORMATS.map((f) => ({ value: f as string, label: FORMAT_LABEL[f] }))]} />
        </div>
        <div className="set-match">
          {matching === undefined ? 'Counting matches' : `${matching} hackathon${matching === 1 ? '' : 's'} on Discover match right now.`}
        </div>
        <Message status={a.status} />
        <div className="set-actions">
          <button type="button" className="btn btn-ink" disabled={a.busy || !dirty} onClick={() => a.run('save', () => actions.updateProfile(draft), 'Interests saved')}>{a.spin('save')}Save interests</button>
          {dirty && <button type="button" className="btn btn-quiet" onClick={() => { setKind(me.interestKind); setTopics(new Set(me.interestTopics)); setStack(new Set(me.interestStack)); setFormat(me.interestFormat ?? ''); }}>Undo changes</button>}
          <span className="spacer" />
          <Link to="/app/discover" className="link">Open Discover</Link>
        </div>
      </div>
    </Section>
  );
}

function PreferencesTab({ me }: { me: User }) {
  const actions = useAuthActions();
  const spaces = useSpaces();
  const a = useAction();
  const save = (body: UserUpdate, key: string) => a.run(key, () => actions.updateProfile(body), 'Saved');
  const sample = new Date();
  sample.setHours(17, 30, 0, 0);

  return (
    <>
      <Section title="Open on" sub="Which list Grind shows when you open it.">
        <label className="field field-narrow-lg" htmlFor="pref-default">
          <select id="pref-default" value={me.defaultSpaceId ?? ''} disabled={a.busy} onChange={(e) => save({ defaultSpaceId: e.target.value || null }, 'default')}>
            <option value="">The last list I used</option>
            <option value="private">My hackathons (private)</option>
            {spaces.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </Section>
      <Section title="Week starts on" sub="For the calendar.">
        <Segmented label="Week starts on" value={me.weekStart} onChange={(v) => save({ weekStart: v }, 'week')} options={[{ value: 'MON', label: 'Monday' }, { value: 'SUN', label: 'Sunday' }]} />
      </Section>
      <Section title="Clock" sub={`Deadlines will show like ${formatClock(sample.toISOString())}.`}>
        <Segmented label="Clock" value={me.timeFormat} onChange={(v) => save({ timeFormat: v }, 'clock')} options={[{ value: 'auto', label: 'Match my device' }, { value: '12h', label: '12 hour' }, { value: '24h', label: '24 hour' }]} />
      </Section>
      <div className="set-inline-status">{a.busy ? <Spinner /> : null}<Message status={a.status} /></div>
    </>
  );
}

function ListsTab() {
  const spaces = useSpaces();
  const me = useMe();
  const { spaceId, setSpaceId } = useSpaceId();
  const navigate = useNavigate();
  const mine = useHackathons();

  return (
    <Section title="Teams" sub="Teams you are in. Invite people, rename or leave on the Team page.">
      {spaces.isPending ? (
        <><Bone className="sk-row" /><Bone className="sk-row" /></>
      ) : (
        <ul className="set-lists">
          <li>
            <Avatar person={me.data} size={36} />
            <span className="set-list-text">
              <strong>My hackathons</strong>
              <span>Private{!spaceId && mine.data ? ` · ${mine.data.length} hackathons` : ''}</span>
            </span>
            <button type="button" className="btn btn-outline" disabled={!spaceId} onClick={() => { setSpaceId(null); navigate('/app/hackathons'); }}>{!spaceId ? 'Showing' : 'Show'}</button>
          </li>
          {spaces.data?.map((s) => (
            <li key={s.id}>
              <Faces people={s.members} max={3} size={26} />
              <span className="set-list-text">
                <strong>{s.name}</strong>
                <span>{s.role === 'OWNER' ? 'Owner' : 'Member'} · {s.members.length} people · {s.hackathonCount} hackathons</span>
              </span>
              <button type="button" className="btn btn-outline" disabled={spaceId === s.id} onClick={() => { setSpaceId(s.id); navigate('/app/hackathons'); }}>{spaceId === s.id ? 'Showing' : 'Show'}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="set-actions">
        <Link to="/app/team" className="btn btn-ink">Manage teams</Link>
      </div>
    </Section>
  );
}

function SecurityTab() {
  const actions = useAuthActions();
  const pw = useAction();
  const dev = useAction();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm.length > 0 && next !== confirm;

  const change = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return;
    const ok = await pw.run('change', () => actions.changePassword({ currentPassword: current, newPassword: next }), 'Password changed. Other devices are signed out.');
    if (ok) { setCurrent(''); setNext(''); setConfirm(''); }
  };

  return (
    <>
      <Section title="Change password" sub="Changing it signs you out on every other device.">
        <form className="set-form set-form-narrow" onSubmit={change}>
          <label className="field" htmlFor="s-current"><span>Current password</span><input id="s-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required maxLength={72} autoComplete="current-password" /></label>
          <label className="field" htmlFor="s-new"><span>New password</span><input id="s-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" /><small>At least 8 characters.</small></label>
          <label className="field" htmlFor="s-confirm"><span>Repeat new password</span><input id="s-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required maxLength={72} autoComplete="new-password" aria-invalid={mismatch} />{mismatch && <small className="field-error">The two new passwords do not match.</small>}</label>
          <Message status={pw.status} />
          <div className="set-actions">
            <button type="submit" className="btn btn-ink" disabled={pw.busy || !current || next.length < 8 || next !== confirm}>{pw.spin('change')}Change password</button>
          </div>
        </form>
      </Section>
      <Section title="Devices" sub="Signed in on a shared or lost device? End every session except this one.">
        <div className="set-actions">
          <button type="button" className="btn btn-outline" disabled={dev.busy} onClick={() => dev.run('out', actions.signOutOthers, 'Signed out on every other device.')}>{dev.spin('out')}Sign out other devices</button>
        </div>
        <Message status={dev.status} />
      </Section>
    </>
  );
}

function DataTab({ me }: { me: User }) {
  const actions = useAuthActions();
  const navigate = useNavigate();
  const ex = useAction();
  const del = useAction();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const stamp = new Date().toISOString().slice(0, 10);

  const exportJson = () =>
    ex.run('json', async () => {
      const data = await actions.exportData();
      download(`grind-export-${stamp}.json`, 'application/json', JSON.stringify(data, null, 2));
    }, 'Download started.');

  const exportCsv = () =>
    ex.run('csv', async () => {
      const data = (await actions.exportData()) as { hackathons: Record<string, unknown>[] };
      const cols = ['list', 'name', 'status', 'organizer', 'url', 'format', 'location', 'startDate', 'endDate', 'registrationDeadline', 'submissionDeadline', 'projectName', 'techStack', 'teammates', 'repoUrl', 'demoUrl', 'won', 'placement', 'prizeName', 'prizeAmount', 'notes'];
      const rows = [cols.join(','), ...data.hackathons.map((h) => cols.map((c) => csvCell(h[c])).join(','))];
      download(`grind-hackathons-${stamp}.csv`, 'text/csv', rows.join('\n'));
    }, 'Download started.');

  const remove = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await del.run('delete', () => actions.deleteAccount(password));
    if (ok) navigate('/', { replace: true });
  };

  return (
    <>
      <Section title="Export" sub="Everything you track, from your private list and every team you are in.">
        <div className="set-actions">
          <button type="button" className="btn btn-outline" disabled={ex.busy} onClick={exportCsv}>{ex.spin('csv')}Download hackathons (CSV)</button>
          <button type="button" className="btn btn-outline" disabled={ex.busy} onClick={exportJson}>{ex.spin('json')}Download everything (JSON)</button>
        </div>
        <Message status={ex.status} />
      </Section>

      <section className="set-section set-danger">
        <header>
          <h2>Delete account</h2>
          <p>
            Deletes your account, your private list and your settings. Hackathons you added to teams stay there for the other members.
            Teams where you are the only member are deleted. This cannot be undone.
          </p>
        </header>
        {!open ? (
          <div className="set-actions"><button type="button" className="btn btn-outline btn-danger-text" onClick={() => setOpen(true)}>Delete my account</button></div>
        ) : (
          <form className="set-form set-form-narrow" onSubmit={remove}>
            <label className="field" htmlFor="d-password"><span>Your password</span><input id="d-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={72} autoComplete="current-password" /></label>
            <label className="field" htmlFor="d-confirm"><span>Type DELETE to confirm</span><input id="d-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder="DELETE" /></label>
            <Message status={del.status} />
            <div className="set-actions">
              <button type="submit" className="btn btn-danger" disabled={del.busy || !password || typed !== 'DELETE'}>{del.spin('delete')}Delete {me.email}</button>
              <button type="button" className="btn btn-quiet" onClick={() => { setOpen(false); setPassword(''); setTyped(''); }}>Keep my account</button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}

// ---------- Page ----------

export function SettingsPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'profile') as TabId;
  const select = (id: TabId) => setParams(id === 'profile' ? {} : { tab: id }, { replace: true });

  if (!me.data) return null;
  const user = me.data;

  return (
    <div className="settings-page">
      <Header me={user} />
      <div className="set-body">
        <nav className="set-tabs" aria-label="Settings sections">
          {TABS.map((t) => (
            <button type="button" key={t.id} className={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => select(t.id)}>
              <strong>{t.label}</strong>
              <span>{t.hint}</span>
            </button>
          ))}
        </nav>
        <div className="set-panel" key={tab}>
          {tab === 'profile' && <ProfileTab me={user} />}
          {tab === 'notifications' && <NotificationsTab me={user} />}
          {tab === 'discover' && <DiscoverTab me={user} />}
          {tab === 'preferences' && <PreferencesTab me={user} />}
          {tab === 'lists' && <ListsTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'data' && <DataTab me={user} />}
        </div>
      </div>
    </div>
  );
}
