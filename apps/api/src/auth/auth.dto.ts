import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Empty strings clear a field, so they become null. */
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t ? t : null;
};
/** People paste links without a scheme, so add one. */
const link = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

const URL_OPTIONS = { require_protocol: true, protocols: ['http', 'https'] };
const URL_MESSAGE = 'Links must be web addresses, like https://github.com/you';

export const AVATAR_COLORS = ['ember', 'violet', 'blue', 'green', 'ink', 'rose'] as const;
export const TOPICS = ['ai', 'mobile', 'gaming', 'hardware', 'data', 'security', 'fintech', 'health', 'climate', 'education', 'social', 'beginner'] as const;
/** About 200 KB of base64, enough for a 256px JPEG with room to spare. */
const MAX_AVATAR_CHARS = 280_000;

export class SignupDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80, { message: 'Enter your name.' })
  name: string;

  @Transform(trimLower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string;

  // bcrypt only reads the first 72 bytes, so longer passwords are rejected.
  @IsString()
  @Length(8, 72, { message: 'Use a password between 8 and 72 characters.' })
  password: string;
}

export class LoginDto {
  @Transform(trimLower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @IsString()
  @Length(1, 72)
  password: string;
}

/** Every field is optional: the client sends only what changed. */
export class UpdateProfileDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 80, { message: 'Enter your name.' })
  name?: string;

  @IsOptional() @IsBoolean()
  emailReminders?: boolean;

  // Profile
  @IsOptional() @Transform(trimOrNull) @IsString()
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, { message: 'Upload a JPEG, PNG or WebP image.' })
  @MaxLength(MAX_AVATAR_CHARS, { message: 'That photo is too large. Try a smaller one.' })
  avatarUrl?: string | null;

  @IsOptional() @IsIn([...AVATAR_COLORS, null])
  avatarColor?: string | null;

  @IsOptional() @Transform(trimOrNull) @IsString() @MaxLength(280, { message: 'Keep the bio to 280 characters.' })
  bio?: string | null;

  @IsOptional() @Transform(link) @IsUrl(URL_OPTIONS, { message: URL_MESSAGE }) @MaxLength(300)
  githubUrl?: string | null;

  @IsOptional() @Transform(link) @IsUrl(URL_OPTIONS, { message: URL_MESSAGE }) @MaxLength(300)
  linkedinUrl?: string | null;

  @IsOptional() @Transform(link) @IsUrl(URL_OPTIONS, { message: URL_MESSAGE }) @MaxLength(300)
  websiteUrl?: string | null;

  @IsOptional() @Transform(link) @IsUrl(URL_OPTIONS, { message: URL_MESSAGE }) @MaxLength(300)
  xUrl?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true })
  skills?: string[];

  // Reminders
  @IsOptional() @IsBoolean()
  remindSubmission3d?: boolean;

  @IsOptional() @IsBoolean()
  remindSubmission1d?: boolean;

  @IsOptional() @IsBoolean()
  remindRegistration1d?: boolean;

  @IsOptional() @IsBoolean()
  weeklyDigest?: boolean;

  // Discover interests
  @IsOptional() @IsIn(['any', 'web3', 'web2'])
  interestKind?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(TOPICS.length) @IsIn([...TOPICS], { each: true })
  interestTopics?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(40, { each: true })
  interestStack?: string[];

  @IsOptional() @IsIn(['ONLINE', 'IN_PERSON', 'HYBRID', null])
  interestFormat?: string | null;

  // Preferences
  @IsOptional() @IsString() @MaxLength(40)
  defaultSpaceId?: string | null;

  @IsOptional() @IsIn(['MON', 'SUN'])
  weekStart?: string;

  @IsOptional() @IsIn(['auto', '12h', '24h'])
  timeFormat?: string;
}

export class ChangePasswordDto {
  @IsString() @Length(1, 72)
  currentPassword: string;

  @IsString() @Length(8, 72, { message: 'Use a new password between 8 and 72 characters.' })
  newPassword: string;
}

export class PasswordDto {
  @IsString() @Length(1, 72, { message: 'Enter your password.' })
  password: string;
}
