import { Link } from 'react-router-dom';
import { Faq } from './About';

const SOLO = [
  'Unlimited hackathons',
  'List, board, calendar and overview',
  'Email reminders before deadlines',
  'Project, team and results records',
];
const TEAM = ['A shared board for your team', 'Invite teammates by email', 'Team-wide record and prize totals'];

const PRICING_FAQ = [
  { q: 'Do I need a card to sign up?', a: 'No. Sign up with a name, an email and a password. Grind never asks for payment details.' },
  { q: 'Is there a limit on how many hackathons I can track?', a: 'No. Track as many as you enter.' },
  { q: 'When does the Team plan arrive?', a: 'It is planned but not built yet, so there is no date and no price. The Solo plan is the whole product today.' },
];

export function PricingPage() {
  return (
    <>
      <section className="page-hero">
        <div className="mkt-wrap">
          <h1>Free while you grind.</h1>
          <p>Everything in Grind today is on the free Solo plan. A Team plan is planned for people who always build together.</p>
        </div>
      </section>

      <section className="section section-flush">
        <div className="mkt-wrap plans">
          <article className="plan plan-main">
            <h2>Solo</h2>
            <p className="plan-price"><strong>$0</strong><span>per month</span></p>
            <p className="plan-note">For one person tracking their own hackathons.</p>
            <ul className="ticks">{SOLO.map((item) => <li key={item}>{item}</li>)}</ul>
            <Link className="btn btn-accent btn-lg" to="/signup">Start tracking free</Link>
          </article>
          <article className="plan">
            <h2>Team</h2>
            <p className="plan-price"><strong>Planned</strong></p>
            <p className="plan-note">For teams that enter together. Not available yet.</p>
            <ul className="ticks ticks-muted">{TEAM.map((item) => <li key={item}>{item}</li>)}</ul>
            <span className="btn btn-outline btn-lg is-disabled" aria-disabled="true">Not available yet</span>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="mkt-wrap narrow">
          <h2 className="faq-title">Pricing questions</h2>
          <Faq items={PRICING_FAQ} />
        </div>
      </section>
    </>
  );
}
