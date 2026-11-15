import { Link, NavLink, Outlet } from 'react-router-dom';
import { useMe } from '../lib/hooks';
import { Logo } from './Logo';

export function MarketingLayout() {
  const me = useMe();
  const loggedIn = Boolean(me.data);
  return (
    <div className="mkt">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="mkt-nav">
        <div className="mkt-wrap mkt-nav-inner">
          <Logo />
          <nav className="mkt-links" aria-label="Main">
            <NavLink to="/features">Features</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>
          <div className="mkt-nav-actions">
            {loggedIn ? (
              <Link className="btn btn-ink" to="/app">Open Grind</Link>
            ) : (
              <>
                <Link className="btn btn-quiet" to="/login">Log in</Link>
                <Link className="btn btn-ink" to="/signup">Start tracking</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        <Outlet />
      </main>

      <footer className="mkt-footer">
        <div className="mkt-wrap mkt-footer-inner">
          <div className="mkt-footer-brand">
            <Logo size={24} />
            <p>The tracker for people who keep signing up for hackathons.</p>
          </div>
          <nav aria-label="Footer">
            <Link to="/features">Features</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/about">About and FAQ</Link>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** The closing call to action shared by the marketing pages. */
export function ClosingCta() {
  return (
    <section className="cta-band">
      <div className="mkt-wrap cta-band-inner">
        <h2>Your next deadline is already counting down.</h2>
        <div className="cta-band-actions">
          <Link className="btn btn-accent btn-lg" to="/signup">Start tracking free</Link>
          <span>Free to use. Takes a minute to set up.</span>
        </div>
      </div>
    </section>
  );
}
