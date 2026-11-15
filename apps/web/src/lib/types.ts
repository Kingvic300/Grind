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

export type Hackathon = {
  id: string;
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
export type HackathonInput = Partial<Omit<Hackathon, 'id' | 'createdAt' | 'updatedAt'>>;
