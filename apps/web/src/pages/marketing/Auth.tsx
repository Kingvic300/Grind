import { type FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/Loading';
import { Logo } from '../../components/Logo';
import { useAuthActions, useMe, useNow } from '../../lib/hooks';
import { countdown } from '../../lib/time';

/** The dark side panel: Grind imagined as shell commands, echoing the logo. */
function TerminalPanel() {
  const now = useNow();
  const [deadline] = useState(() => new Date(Date.now() + 5.69 * 3_600_000).toISOString());
  return (
    <aside className="auth-side" aria-hidden="true">
      <div className="terminal">
        <p><b>&gt;</b> grind add "Open Data Jam"</p>
        <p className="out">added, status: interested</p>
        <p><b>&gt;</b> grind move "Open Data Jam" building</p>
        <p className="out">submission closes in <span className="hot">{countdown(deadline, now).text}</span></p>
        <p><b>&gt;</b> grind submit --project floodline</p>
        <p className="out">submitted. good luck.</p>
        <p><b>&gt;</b> <i className="terminal-cursor" /></p>
      </div>
      <p className="auth-side-note">Grind is a web app, not a command line tool. It just thinks like one.</p>
    </aside>
  );
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const me = useMe();
  const actions = useAuthActions();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';
  const from = (location.state as { from?: string } | null)?.from ?? '/app';

  if (me.data) return <Navigate to={from} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (signup) await actions.signup({ name, email, password });
      else await actions.login({ email, password });
      navigate(from, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <main className="auth-main">
        <Logo />
        <form className="auth-form" onSubmit={submit}>
          <h1>{signup ? 'Create your Grind account' : 'Log in to Grind'}</h1>
          <p className="auth-lede">
            {signup ? 'Start tracking your hackathons in about a minute.' : 'Pick up where you left off.'}
          </p>

          {signup && (
            <label className="field" htmlFor="auth-name">
              <span>Name</span>
              <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" autoFocus />
            </label>
          )}
          <label className="field" htmlFor="auth-email">
            <span>Email</span>
            <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus={!signup} />
          </label>
          <label className="field" htmlFor="auth-password">
            <span>Password</span>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={signup ? 8 : 1}
              maxLength={72}
              autoComplete={signup ? 'new-password' : 'current-password'}
              aria-describedby={signup ? 'auth-password-hint' : undefined}
            />
            {signup && <small id="auth-password-hint">At least 8 characters.</small>}
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-accent btn-lg btn-block" disabled={busy}>
            {busy && <Spinner />}
            {busy ? (signup ? 'Creating account' : 'Logging in') : signup ? 'Create account' : 'Log in'}
          </button>

          <p className="auth-switch">
            {signup ? 'Already have an account? ' : 'New to Grind? '}
            <Link to={signup ? '/login' : '/signup'} state={location.state}>{signup ? 'Log in' : 'Create an account'}</Link>
          </p>
        </form>
      </main>
      <TerminalPanel />
    </div>
  );
}
