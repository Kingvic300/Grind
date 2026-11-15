import { Link } from 'react-router-dom';

/** The Grind mark: a shell prompt with a blinking cursor. */
export function LogoMark({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="11" fill={onDark ? '#FFFFFF' : '#12141C'} />
      <path
        d="M14 16 L22 24 L14 32"
        fill="none"
        stroke={onDark ? '#12141C' : '#FFFFFF'}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect className="logo-cursor" x="25" y="29" width="11" height="4.5" rx="1.5" fill="#F2541B" />
    </svg>
  );
}

export function Logo({ to = '/', onDark = false, size = 28 }: { to?: string; onDark?: boolean; size?: number }) {
  return (
    <Link to={to} className={`logo${onDark ? ' logo-on-dark' : ''}`} aria-label="Grind home">
      <LogoMark size={size} onDark={onDark} />
      <span className="logo-word" style={{ fontSize: size * 0.82 }}>
        grind
      </span>
    </Link>
  );
}
