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

/** A team: a shared hackathon list everyone in it can edit. */
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
  /** Team members responsible for it. */
  assignees: Profile[];
  taskCount: number;
  tasksDone: number;
  commentCount: number;
};

/** The fields a client may send when creating or editing a hackathon. */
export type HackathonInput = Partial<
  Omit<Hackathon, 'id' | 'spaceId' | 'user' | 'updatedBy' | 'createdAt' | 'updatedAt' | 'assignees' | 'taskCount' | 'tasksDone' | 'commentCount'>
> & { assigneeIds?: string[] };

export type Task = { id: string; title: string; done: boolean; position: number; createdAt: string; assignee: Profile | null };

export type Comment = { id: string; body: string; createdAt: string; author: Profile | null };

export type ActivityKind =
  | 'added' | 'moved' | 'edited' | 'deleted' | 'assigned'
  | 'task_added' | 'task_done' | 'commented' | 'joined' | 'left' | 'renamed' | 'imported';

export type Activity = {
  id: string;
  kind: ActivityKind;
  detail: string | null;
  hackathonId: string | null;
  hackathonName: string | null;
  createdAt: string;
  actor: Profile | null;
};

export const SOURCES = ['devpost', 'dorahacks', 'devfolio', 'mlh', 'superteam', 'ethglobal', 'taikai', 'unstop', 'hackerearth', 'hackclub', 'linkedin'] as const;

export const SOURCE_LABEL: Record<Source, string> = {
  devpost: 'Devpost', dorahacks: 'DoraHacks', devfolio: 'Devfolio', mlh: 'MLH', superteam: 'Superteam Earn',
  ethglobal: 'ETHGlobal', taikai: 'Taikai', unstop: 'Unstop', hackerearth: 'HackerEarth', hackclub: 'Hack Club',
  linkedin: 'LinkedIn',
};
export type Source = (typeof SOURCES)[number];

/** A hackathon found on a public site, not yet in any Grind list. */
export type Listing = {
  id: string;
  source: Source;
  /** A bounty is a paid task with a deadline, not an event. Only Superteam Earn has them. */
  kind: 'hackathon' | 'bounty';
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

/** Details read from a pasted hackathon link. A draft for the form; nothing is saved yet. */
export type ScanResult = {
  name: string;
  organizer: string | null;
  url: string;
  format: Format | null;
  location: string | null;
  /** "YYYY-MM-DD" */
  startDate: string | null;
  endDate: string | null;
  /** An ISO moment, or a "YYYY-MM-DD" day when the page gave no time. */
  registrationDeadline: string | null;
  submissionDeadline: string | null;
  prize: string | null;
  stack: string[];
  /** Where the details came from, such as "Devpost" or the page's host. */
  site: string;
};

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
