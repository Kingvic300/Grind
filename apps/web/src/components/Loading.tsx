/** Inline spinner for buttons. Takes the button's text colour. */
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** One grey placeholder block. Size it with className or style. */
export function Bone({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={`bone ${className}`} style={style} aria-hidden="true" />;
}

/** Wraps a skeleton so screen readers hear one short status instead of empty blocks. */
function Skeleton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function HeadBones({ actions = false }: { actions?: boolean }) {
  return (
    <div className="sk-head">
      <div>
        <Bone className="sk-title" />
        <Bone className="sk-line" style={{ width: 'min(360px, 70%)' }} />
      </div>
      {actions && <Bone className="sk-btn" />}
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <Skeleton label="Loading your overview">
      <HeadBones />
      <div className="tiles">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="tile" key={i}>
            <Bone className="sk-line" style={{ width: '50%' }} />
            <Bone className="sk-num" />
          </div>
        ))}
      </div>
      <div className="overview-grid">
        {[5, 4].map((rows, i) => (
          <div className="panel" key={i}>
            <Bone className="sk-line" style={{ width: '40%', height: 18 }} />
            {Array.from({ length: rows }, (_, r) => <Bone key={r} className="sk-row" />)}
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function ListSkeleton() {
  return (
    <Skeleton label="Loading your hackathons">
      <HeadBones />
      <div className="toolbar"><Bone className="sk-input" /><Bone className="sk-btn" /></div>
      <div className="filters">{Array.from({ length: 6 }, (_, i) => <Bone key={i} className="sk-pill" />)}</div>
      <div className="table-wrap sk-table">
        {Array.from({ length: 7 }, (_, i) => (
          <div className="sk-table-row" key={i}>
            <span className="sk-stack"><Bone className="sk-line" style={{ width: '70%' }} /><Bone className="sk-line sk-faint" style={{ width: '45%' }} /></span>
            <Bone className="sk-pill" />
            <Bone className="sk-line sk-hide-sm" style={{ width: '60%' }} />
            <Bone className="sk-line" style={{ width: '50%' }} />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function BoardSkeleton() {
  return (
    <Skeleton label="Loading your board">
      <HeadBones />
      <div className="board">
        {[3, 2, 2, 1, 1].map((cards, i) => (
          <div className="column" key={i}>
            <Bone className="sk-line" style={{ width: '55%' }} />
            {Array.from({ length: cards }, (_, c) => (
              <div className="card sk-card" key={c}>
                <Bone className="sk-line" style={{ width: '80%' }} />
                <Bone className="sk-line sk-faint" style={{ width: '50%' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function CalendarSkeleton() {
  return (
    <Skeleton label="Loading your calendar">
      <HeadBones actions />
      <div className="cal">
        <div className="cal-weekdays">{Array.from({ length: 7 }, (_, i) => <span key={i}><Bone className="sk-line" style={{ width: 28 }} /></span>)}</div>
        {Array.from({ length: 5 }, (_, w) => (
          <div className="cal-week sk-week" key={w}>
            {Array.from({ length: 7 }, (_, d) => (
              <div className="sk-day" key={d}>
                <Bone className="sk-line" style={{ width: 18 }} />
                {(w * 7 + d) % 5 === 1 && <Bone className="sk-bar" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function CardsSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <HeadBones />
      <div className="toolbar"><Bone className="sk-input" /><Bone className="sk-btn" /></div>
      <div className="filters">{Array.from({ length: 5 }, (_, i) => <Bone key={i} className="sk-pill" />)}</div>
      <div className="listings">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="listing" key={i}>
            <div className="listing-top">
              <Bone className="sk-img" />
              <span className="sk-stack" style={{ flex: 1 }}>
                <Bone className="sk-line" style={{ width: 70 }} />
                <Bone className="sk-line" style={{ width: '85%', height: 16 }} />
              </span>
            </div>
            <Bone className="sk-line" style={{ width: '65%' }} />
            <Bone className="sk-line sk-faint" style={{ width: '45%' }} />
            <Bone className="sk-btn" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function PanelsSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <HeadBones />
      <div className="sharing">
        {[2, 4].map((rows, i) => (
          <div className="panel" key={i}>
            <Bone className="sk-line" style={{ width: '35%', height: 18 }} />
            {Array.from({ length: rows }, (_, r) => <Bone key={r} className="sk-row" />)}
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/** Shown while Grind checks the session, before it knows which page to draw. */
export function AppSkeleton() {
  return (
    <div className="shell" role="status" aria-live="polite">
      <span className="sr-only">Loading Grind</span>
      <aside className="shell-side">
        <Bone className="sk-dark" style={{ width: 110, height: 28 }} />
        <Bone className="sk-dark" style={{ height: 58 }} />
        <Bone className="sk-dark" style={{ height: 42 }} />
        {Array.from({ length: 6 }, (_, i) => <Bone key={i} className="sk-dark" style={{ height: 22, width: `${70 - i * 4}%` }} />)}
      </aside>
      <main className="shell-main">
        <OverviewSkeleton />
      </main>
    </div>
  );
}
