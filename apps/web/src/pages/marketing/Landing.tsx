import { Link } from 'react-router-dom';
import { ClosingCta } from '../../components/MarketingLayout';
import { DemoBoard, MiniCalendar, MiniList, MiniStats, ProjectRecord, ReminderEmail } from '../../components/Previews';

export function LandingPage() {
  return (
    <>
      <section className="hero">
        <div className="mkt-wrap hero-inner">
          <div className="hero-copy">
            <h1>Every hackathon you enter, in one place.</h1>
            <p>
              Grind keeps the deadlines, teammates, projects and results for each one, so nothing slips while you
              are busy building.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-accent btn-lg" to="/signup">Start tracking free</Link>
              <Link className="btn btn-outline btn-lg" to="/features">See the features</Link>
            </div>
          </div>
          <DemoBoard />
        </div>
      </section>

      <section className="section">
        <div className="mkt-wrap">
          <div className="section-head">
            <h2>One list, four ways to look at it.</h2>
            <p>Add a hackathon once. Grind shows it wherever it is useful.</p>
          </div>
          <div className="bento">
            <article className="bento-cell bento-wide">
              <MiniList />
              <h3>A list you can search</h3>
              <p>Filter by status, sort by the nearest deadline, and find any event by name, tech or teammate.</p>
            </article>
            <article className="bento-cell">
              <MiniCalendar />
              <h3>A calendar of event days</h3>
              <p>See which weekends are taken and which deadlines land in the same week.</p>
            </article>
            <article className="bento-cell">
              <MiniStats />
              <h3>Your record so far</h3>
              <p>Entries, wins, prize money and the tech you reach for most.</p>
            </article>
            <article className="bento-cell bento-wide bento-ink">
              <div className="bento-flow" aria-hidden="true">
                <span className="pill pill-interested">Interested</span>
                <span className="pill pill-registered">Registered</span>
                <span className="pill pill-building">Building</span>
                <span className="pill pill-submitted">Submitted</span>
                <span className="pill pill-done">Done</span>
              </div>
              <h3>A board that follows the weekend</h3>
              <p>Drag a card from Interested to Done as the event moves. The board above is the real thing.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="mkt-wrap split">
          <ReminderEmail />
          <div className="split-copy">
            <h2>The deadline finds you.</h2>
            <p>
              Grind emails you three days and one day before submission closes, and one day before registration
              closes. Inside the app, every open deadline counts down to the second.
            </p>
            <ul className="ticks">
              <li>Reminders stop once you mark a hackathon submitted.</li>
              <li>Deadlines are shown in your own time zone.</li>
              <li>Turn emails off in settings with one switch.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="mkt-wrap split split-reverse">
          <ProjectRecord />
          <div className="split-copy">
            <h2>Remember what you built, and with whom.</h2>
            <p>
              Each hackathon keeps its project, stack, team, links and result. Six months later you still know
              what worked, who you would team up with again, and what the judges liked.
            </p>
            <Link className="text-link" to="/features">Read about everything Grind tracks</Link>
          </div>
        </div>
      </section>

      <ClosingCta />
    </>
  );
}
