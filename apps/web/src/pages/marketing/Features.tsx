import type { ReactNode } from 'react';
import { ClosingCta } from '../../components/MarketingLayout';
import { DemoBoard, MiniCalendar, MiniList, MiniStats, ProjectRecord, ReminderEmail } from '../../components/Previews';

const FEATURES: { title: string; body: string; points: string[]; preview: ReactNode }[] = [
  {
    title: 'Track the basics without a spreadsheet',
    body: 'Give a hackathon a name and it is tracked. Add the organizer, link, dates and whether it is online, in person or hybrid when you know them.',
    points: ['Search by name, project, tech or teammate', 'Filter by status', 'Sort by the nearest submission deadline'],
    preview: <MiniList />,
  },
  {
    title: 'Move each one through five statuses',
    body: 'Interested, Registered, Building, Submitted, Done. Drag a card across the board, or set the status from the editor.',
    points: ['Drag and drop with mouse, touch or keyboard', 'Open deadlines count down on the card', 'Wins show a trophy badge'],
    preview: <DemoBoard />,
  },
  {
    title: 'See the month before you commit',
    body: 'The calendar marks every event day and every deadline, so you can spot two submissions due in the same week before you sign up for both.',
    points: ['Event days coloured by status', 'Registration and submission deadlines', 'An agenda list under each month'],
    preview: <MiniCalendar />,
  },
  {
    title: 'Get reminded before it is too late',
    body: 'Grind sends an email three days and one day before submission closes, and one day before registration closes.',
    points: ['Reminders stop when you mark it submitted', 'Live countdowns inside the app', 'One switch turns emails off'],
    preview: <ReminderEmail />,
  },
  {
    title: 'Keep the project and the team',
    body: 'Record what you built, the stack, your teammates, and the repository and demo links, then the placement, prize and lessons afterwards.',
    points: ['Project name and description', 'Tech stack and teammates', 'Placement, prize money and notes'],
    preview: <ProjectRecord />,
  },
  {
    title: 'Know your record',
    body: 'The overview adds everything up: how many you entered and submitted, how often you won, total prize money, and the tech you use most.',
    points: ['Win rate across submissions', 'Total prize money', 'Most used technologies'],
    preview: <MiniStats />,
  },
];

export function FeaturesPage() {
  return (
    <>
      <section className="page-hero">
        <div className="mkt-wrap">
          <h1>Everything Grind tracks for you.</h1>
          <p>Six parts, built around how a hackathon actually goes: you find it, join it, build, submit, and look back.</p>
        </div>
      </section>

      <section className="section section-flush">
        <div className="mkt-wrap feature-rows">
          {FEATURES.map((feature, index) => (
            <article className={`split${index % 2 ? ' split-reverse' : ''}`} key={feature.title}>
              <div className="feature-preview">{feature.preview}</div>
              <div className="split-copy">
                <h2>{feature.title}</h2>
                <p>{feature.body}</p>
                <ul className="ticks">
                  {feature.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ClosingCta />
    </>
  );
}
