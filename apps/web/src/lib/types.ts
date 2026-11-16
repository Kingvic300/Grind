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

export const AVATAR_COLORS = ['ember', 'violet', 'blue', 'green', 'ink', 'rose'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** What one person shows to others: in the sidebar, shared lists and Settings. */
export type Profile = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  bio?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  xUrl?: string | null;
  skills?: string[];
};

export type User = Profile & {
  email: string;
  createdAt: string;
  skills: string[];
  emailReminders: boolean;
  remindSubmission3d: boolean;
  remindSubmission1d: boolean;
  remindRegistration1d: boolean;
  weeklyDigest: boolean;
  interestKind: 'any' | 'web3' | 'web2';
  interestTopics: string[];
  interestStack: string[];
  interestFormat: Format | null;
  defaultSpaceId: string | null;
  weekStart: 'MON' | 'SUN';
  timeFormat: 'auto' | '12h' | '24h';
  calendarFeed: boolean;
};

export type UserUpdate = Partial<Omit<User, 'id' | 'email' | 'createdAt' | 'calendarFeed'>>;

export type Stats = { tracked: number; submitted: number; wins: number; prizeMoney: number; sharedLists: number };

export type Person = { id: string; name: string };

export type SpaceMember = Profile & { email: string; role: 'OWNER' | 'MEMBER'; joinedAt: string };

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

/** Tech the Discover classifier knows, for the interests picker. Keep in step with the API. */
export const STACK_NAMES = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Vue', 'Rust', 'Go', 'Java', 'Kotlin', 'Swift', 'Flutter',
  'React Native', 'C++', 'Solidity', 'Move', 'Cairo', 'Foundry', 'Hardhat', 'Ethereum', 'Solana', 'Polygon', 'Arbitrum', 'Starknet',
  'Sui', 'Aptos', 'Chainlink', 'IPFS', 'OpenAI', 'Gemini', 'Claude', 'LangChain', 'Hugging Face', 'TensorFlow', 'PyTorch', 'AWS',
  'Google Cloud', 'Azure', 'Firebase', 'Supabase', 'MongoDB', 'PostgreSQL', 'Docker', 'Kubernetes', 'Unity', 'Unreal', 'Three.js',
  'Figma', 'Arduino', 'Raspberry Pi',
] as const;

type Interests = Pick<User, 'interestKind' | 'interestTopics' | 'interestStack' | 'interestFormat'>;

export const hasInterests = (u: Interests) =>
  u.interestKind !== 'any' || u.interestTopics.length > 0 || u.interestStack.length > 0 || Boolean(u.interestFormat);

/** True when a Discover listing fits the user's saved interests. Mirrors the API digest rule. */
export function matchesInterests(h: Listing, u: Interests): boolean {
  if (!hasInterests(u)) return false;
  const web3 = h.categories.includes('web3');
  if (u.interestKind === 'web3' && !web3) return false;
  if (u.interestKind === 'web2' && web3) return false;
  if (u.interestFormat && h.format !== u.interestFormat) return false;
  const wantsTopics = u.interestTopics.length > 0;
  const wantsStack = u.interestStack.length > 0;
  if (!wantsTopics && !wantsStack) return true;
  return (wantsTopics && u.interestTopics.some((t) => (h.categories as string[]).includes(t))) || (wantsStack && u.interestStack.some((s) => h.stack.includes(s)));
}
