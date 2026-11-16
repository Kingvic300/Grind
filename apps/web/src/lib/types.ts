export const STATUSES = ['INTERESTED', 'REGISTERED', 'BUILDING', 'SUBMITTED', 'DONE'] as const;
export type Status = (typeof STATUSES)[number];

export const FORMATS = ['ONLINE', 'IN_PERSON', 'HYBRID'] as const;
export type Format = (typeof FORMATS)[number];

export const STATUS_LABEL: Record<Status, string> = {
  INTERESTED: 'Interested',
  REGISTERED: 'Registered',
  BUILDING: 'Building',
  SUBMITTED: 'Submitted',
  DONE: 'Done',
};

export const FORMAT_LABEL: Record<Format, string> = {
  ONLINE: 'Online',
  IN_PERSON: 'In person',
  HYBRID: 'Hybrid',
};

export type User = {
  id: string;
  email: string;
  name: string;
  emailReminders: boolean;
  createdAt: string;
};

export type Person = { id: string; name: string };

export type SpaceMember = Person & { email: string; role: 'OWNER' | 'MEMBER'; joinedAt: string };

/** A shared hackathon list. */
export type Space = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  hackathonCount: number;
  role: 'OWNER' | 'MEMBER';
  members: SpaceMember[];
};

export type InvitePreview = {
  id: string;
  name: string;
  memberNames: string[];
  hackathonCount: number;
  alreadyMember: boolean;
};

export type Hackathon = {
  id: string;
  spaceId: string | null;
  /** Who added it. */
  user: Person;
  /** Who saved it last. Null when that account no longer exists. */
  updatedBy: Person | null;
  name: string;
  organizer: string | null;
  url: string | null;
  format: Format;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  status: Status;
  position: number;
  registrationDeadline: string | null;
  submissionDeadline: string | null;
  projectName: string | null;
  projectDescription: string | null;
  techStack: string[];
  teammates: string[];
  repoUrl: string | null;
  demoUrl: string | null;
  won: boolean;
  placement: string | null;
  prizeName: string | null;
  prizeAmount: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The fields a client may send when creating or editing a hackathon. */
export type HackathonInput = Partial<Omit<Hackathon, 'id' | 'spaceId' | 'user' | 'updatedBy' | 'createdAt' | 'updatedAt'>>;

export const SOURCES = ['devpost', 'dorahacks', 'devfolio', 'mlh'] as const;
export type Source = (typeof SOURCES)[number];

/** A hackathon found on a public site, not yet in any Grind list. */
export type Listing = {
  id: string;
  source: Source;
  name: string;
  organizer: string | null;
  url: string;
  format: Format;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  registrationDeadline: string | null;
  submissionDeadline: string | null;
  prize: string | null;
  tags: string[];
  imageUrl: string | null;
  description: string | null;
  categories: Category[];
  stack: string[];
};

export const CATEGORY_LABEL = {
  web3: 'Web3',
  ai: 'AI and ML',
  mobile: 'Mobile',
  gaming: 'Gaming',
  hardware: 'Hardware and IoT',
  data: 'Data',
  security: 'Security',
  fintech: 'Fintech',
  health: 'Health',
  climate: 'Climate',
  education: 'Education',
  social: 'Social good',
  beginner: 'Beginner friendly',
} as const;
export type Category = keyof typeof CATEGORY_LABEL;

export type DiscoverResult = {
  fetchedAt: string;
  sources: { source: Source; label: string; ok: boolean; count: number; error?: string }[];
  hackathons: Listing[];
};
