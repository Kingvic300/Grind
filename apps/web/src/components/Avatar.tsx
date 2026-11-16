import type { Profile } from '../lib/types';

/** A person's photo, or their initial on their chosen colour. */
export function Avatar({ person, size = 34, className = '' }: { person?: Profile | null; size?: number; className?: string }) {
  const initial = person?.name?.trim().slice(0, 1).toUpperCase() || '?';
  const color = person?.avatarColor ?? 'ember';
  return (
    <span
      className={`avatar avatar-${color} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), borderRadius: Math.round(size * 0.3) }}
      aria-hidden="true"
    >
      {person?.avatarUrl ? <img src={person.avatarUrl} alt="" /> : initial}
    </span>
  );
}
