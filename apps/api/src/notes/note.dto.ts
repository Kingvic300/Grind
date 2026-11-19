import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** "devpost.com/x" becomes "https://devpost.com/x", so pasted links without a scheme still work. */
const withScheme = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? `https://${v}` : v;
};

// Optional fields accept null, which clears the stored value.
export class CreateNoteDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(4000, { message: 'Keep the note under 4000 characters.' })
  body?: string | null;

  @IsOptional() @Transform(withScheme)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'That link does not look right.' })
  @MaxLength(1000)
  url?: string | null;

  @IsOptional() @IsDateString()
  remindAt?: string | null;

  /** Set to share the note with a team. Leave out for a personal note. */
  @IsOptional() @IsString() @MaxLength(40)
  spaceId?: string | null;
}

export class UpdateNoteDto extends PartialType(OmitType(CreateNoteDto, ['spaceId'] as const)) {
  @IsOptional() @IsBoolean()
  done?: boolean;
}
