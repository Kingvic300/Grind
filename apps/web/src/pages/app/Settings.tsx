import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../components/AppShell';
import { Spinner } from '../../components/Loading';
import { useAuthActions, useMe } from '../../lib/hooks';

export function SettingsPage() {
  const me = useMe();
  const actions = useAuthActions();
  const navigate = useNavigate();
  const [name, setName] = useState(me.data?.name ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [working, setWorking] = useState<'name' | 'reminders' | 'logout' | null>(null);
  const busy = working !== null;

  const run = async (key: 'name' | 'reminders', work: () => Promise<unknown>, done: string) => {
    setWorking(key);
    setMessage(null);
    try {
      await work();
      setMessage({ ok: true, text: done });
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message });
    } finally {
      setWorking(null);
    }
  };

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    void run('name', () => actions.updateProfile({ name: name.trim() }), 'Name saved');
  };

  const logout = async () => {
    setWorking('logout');
    await actions.logout();
    navigate('/');
  };

  if (!me.data) return null;

  return (
    <>
      <PageHead title="Settings" />
      <div className="settings">
        <form className="panel" onSubmit={saveName}>
          <h2>Profile</h2>
          <label className="field" htmlFor="settings-name">
            <span>Name</span>
            <input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </label>
          <label className="field" htmlFor="settings-email">
            <span>Email</span>
            <input id="settings-email" value={me.data.email} readOnly />
          </label>
          <button type="submit" className="btn btn-ink" disabled={busy || !name.trim() || name.trim() === me.data.name}>{working === 'name' && <Spinner />}Save name</button>
        </form>

        <section className="panel">
          <h2>Reminders</h2>
          <label className="switch">
            <input
              type="checkbox"
              checked={me.data.emailReminders}
              disabled={busy}
              onChange={(e) => {
                const on = e.target.checked;
                void run('reminders', () => actions.updateProfile({ emailReminders: on }), on ? 'Email reminders on' : 'Email reminders off');
              }}
            />
            <span className="switch-track" aria-hidden="true" />
            <span>
              <strong>Email me before deadlines {working === 'reminders' && <Spinner />}</strong>
              <span>3 days and 1 day before submission closes, and 1 day before registration closes. Sent to {me.data.email}.</span>
            </span>
          </label>
        </section>

        {message && <p className={message.ok ? 'form-ok' : 'form-error'} role="status">{message.text}</p>}

        <section className="panel">
          <h2>Session</h2>
          <button type="button" className="btn btn-outline" onClick={logout} disabled={busy}>{working === 'logout' && <Spinner />}Log out</button>
        </section>
      </div>
    </>
  );
}
