import type { ReactNode } from 'react';

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconOverview = () => <Icon><path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" /></Icon>;
export const IconList = () => <Icon><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></Icon>;
export const IconBoard = () => <Icon><path d="M5 4h4v16H5zM15 4h4v9h-4z" /></Icon>;
export const IconCalendar = () => <Icon><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4" /></Icon>;
export const IconSettings = () => <Icon><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></Icon>;
export const IconPlus = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>;
export const IconClose = () => <Icon><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const IconSearch = () => <Icon><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></Icon>;
export const IconChevronLeft = () => <Icon><path d="M15 6l-6 6 6 6" /></Icon>;
export const IconChevronRight = () => <Icon><path d="M9 6l6 6-6 6" /></Icon>;
export const IconCheck = () => <Icon size={16}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const IconTrophy = () => <Icon size={15}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" /></Icon>;
export const IconUsers = () => <Icon><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14a5.5 5.5 0 0 1 3 5" /></Icon>;
export const IconLock = () => <Icon size={15}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>;
export const IconLink = () => <Icon size={16}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Icon>;
export const IconCompass = () => <Icon><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></Icon>;
export const IconLogout = () => <Icon><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" /></Icon>;
export const IconChevronDown = () => <Icon size={16}><path d="M6 9l6 6 6-6" /></Icon>;
