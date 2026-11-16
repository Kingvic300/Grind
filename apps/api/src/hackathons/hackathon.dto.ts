import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Format, Status } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const URL_OPTIONS = { require_protocol: true, protocols: ['http', 'https'] };
const URL_MESSAGE = 'Links must start with http:// or https://';

// Optional fields accept null, which clears the stored value.
export class CreateHackathonDto {
  @IsString()
  @Length(1, 120, { message: 'Give the hackathon a name.' })
  name: string;

  @IsOptional() @IsString() @MaxLength(120)
  organizer?: string | null;

  @IsOptional() @IsUrl(URL_OPTIONS, { message: URL_MESSAGE }) @MaxLength(500)
  url?: string | null;

  @IsOptional() @IsEnum(Format)
  format?: Format;

  @IsOptional() @IsString() @MaxLength(120)
  location?: string | null;

  @IsOptional() @IsDateString()
  startDate?: string | null;

  @IsOptional() @IsDateString()
  endDate?: string | null;

  @IsOptional() @IsEnum(Status)
  status?: Status;

  @IsOptional() @IsNumber()
  position?: number;

  @IsOptional() @IsDateString()
  registrationDeadline?: string | null;

  @IsOptional() @IsDateString()
  submissionDeadline?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  projectName?: string | null;

  @IsOptional() @IsString() @MaxLength(2000)
  projectDescription?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(40, { each: true })
  techStack?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true })
  teammates?: string[];

  @IsOptional() @IsUrl(URL_OPTIONS, { message: URL_MESSAGE }) @MaxLength(500)
  repoUrl?: string | null;

  @IsOptional() @IsUrl(URL_OPTIONS, { message: URL_MESSAGE }) @MaxLength(500)
  demoUrl?: string | null;

  @IsOptional() @IsBoolean()
  won?: boolean;

  @IsOptional() @IsString() @MaxLength(60)
  placement?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  prizeName?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(100_000_000)
  prizeAmount?: number | null;

  @IsOptional() @IsString() @MaxLength(5000)
  notes?: string | null;

  /** Shared list to add the hackathon to. Leave out for the private list. Set only on create. */
  @IsOptional() @IsString() @MaxLength(40)
  spaceId?: string | null;
}

export class UpdateHackathonDto extends PartialType(OmitType(CreateHackathonDto, ['spaceId'] as const)) {
  /** Replaces the full set of assigned team members. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  assigneeIds?: string[];
}

/** Rows parsed from a spreadsheet. The service validates each row on its own, so one bad row does not block the rest. */
export class ImportHackathonsDto {
  @IsOptional() @IsString() @MaxLength(40)
  spaceId?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'The file has no rows to import.' })
  @ArrayMaxSize(200, { message: 'Send at most 200 rows at a time.' })
  @IsObject({ each: true })
  rows: Record<string, unknown>[];
}
