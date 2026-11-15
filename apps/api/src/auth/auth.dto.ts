import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 80, { message: 'Enter your name.' })
  name?: string;

  @IsOptional()
  @IsBoolean()
  emailReminders?: boolean;
}
