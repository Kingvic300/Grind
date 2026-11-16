import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useInvitePreview, useSpaceActions } from '../lib/hooks';
import { rememberSpace } from '../lib/space';

/** Where an invite link lands. RequireAuth sends logged-out visitors to log in first. */
export function JoinPage() {
  const { code = '' } = useParams();
  const preview = useInvitePreview(code);
  const actions = useSpaceActions();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const open = (spaceId: string) => {
    rememberSpace(spaceId);
    navigate('/app/hackathons', { replace: true });
  };

  const join = async () => {
    setError('');
    setBusy(true);
    try {
      open((await actions.join(code)).id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!code) return <Navigate to="/app" replace />;

  return (
    <div className="join">
      <Logo />
      <section className="panel join-card">
        {preview.isPending && <p className="muted" role="status">Checking the invite</p>}
        {preview.isError && (
          <>
            <h1>Invite not found</h1>
            <p className="muted">{preview.error.message}</p>
            <Link className="btn btn-outline" to="/app">Go to Grind</Link>
          </>
        )}
        {preview.data && (
          <>
            <p className="join-kicker">Shared hackathon list</p>
            <h1>{preview.data.name}</h1>
            <p className="muted">
              {preview.data.memberNames.join(', ')} {preview.data.memberNames.length === 1 ? 'tracks' : 'track'}{' '}
              {preview.data.hackathonCount} {preview.data.hackathonCount === 1 ? 'hackathon' : 'hackathons'} here.
              Join to see them and edit together.
            </p>
            {error && <p className="form-error" role="alert">{error}</p>}
            {preview.data.alreadyMember ? (
              <button type="button" className="btn btn-accent btn-lg btn-block" onClick={() => open(preview.data.id)}>
                You are in. Open the list
              </button>
            ) : (
              <button type="button" className="btn btn-accent btn-lg btn-block" onClick={join} disabled={busy}>
                {busy ? 'Joining' : 'Join list'}
              </button>
            )}
            <Link className="link" to="/app">Not now</Link>
          </>
        )}
      </section>
    </div>
  );
}
