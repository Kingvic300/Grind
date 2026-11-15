import { ClosingCta } from '../../components/MarketingLayout';

const FAQ = [
  { q: 'What is Grind for?', a: 'Grind tracks the hackathons you enter. Each one keeps its dates, status, deadlines, project, team and result, and you can view them as a list, a board, a calendar or a set of totals.' },
  { q: 'Does it cost anything?', a: 'No. Everything in Grind today is free.' },
  { q: 'What emails will I get?', a: 'Only deadline reminders: three days and one day before a submission closes, and one day before a registration closes. You can turn them off in settings.' },
  { q: 'Can I track in-person and online hackathons?', a: 'Yes. Each hackathon is marked online, in person or hybrid, and can have a location.' },
  { q: 'Who can see my hackathons?', a: 'Only you. Each account sees its own hackathons, and passwords are stored hashed, never in plain text.' },
  { q: 'Can I share a board with my team?', a: 'Not yet. Shared team boards are planned. For now you can list your teammates on each hackathon.' },
];

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="faq">
      {items.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export function AboutPage() {
  return (
    <>
      <section className="page-hero">
        <div className="mkt-wrap">
          <h1>Built for people who keep signing up.</h1>
          <p>Hackathons are short. The details around them are not.</p>
        </div>
      </section>

      <section className="section section-flush">
        <div className="mkt-wrap about">
          <div className="about-story">
            <p>
              A hackathon lasts a weekend, but the information around it is scattered for weeks. The registration
              form is in one tab, the deadline is in an email, the team is in a group chat, and the repository is
              wherever you left it.
            </p>
            <p>
              Enter a few each season and it gets worse. You miss a registration window. You forget which project
              won what. You cannot remember which stack you used the last time something worked.
            </p>
            <p>
              Grind puts all of it in one place. You add a hackathon once, move it along as the weekend happens,
              and write down how it ended. Over time it becomes a record of everything you have built.
            </p>
          </div>
          <aside className="about-principles">
            <h2>How Grind is built</h2>
            <dl>
              <div><dt>Fast to add</dt><dd>A name is enough. Everything else is optional and can wait.</dd></div>
              <div><dt>Deadlines first</dt><dd>The nearest deadline is always the easiest thing to see.</dd></div>
              <div><dt>Yours alone</dt><dd>Your hackathons are private to your account.</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="section section-tint">
        <div className="mkt-wrap">
          <h2 className="faq-title">Questions people ask</h2>
          <Faq items={FAQ} />
        </div>
      </section>

      <ClosingCta />
    </>
  );
}
