import { OmitType, PartialType } from '@nestjs/mapped-types';
import { GoalKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Optional fields accept null, which clears the stored value.
export class CreateGoalDto {
  @IsEnum(GoalKind, { message: 'Pick what the goal counts.' })
  kind: GoalKind;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(160, { message: 'Keep the goal under 160 characters.' })
  title?: string | null;

  @IsOptional() @IsInt({ message: 'The target must be a whole number.' }) @Min(1, { message: 'The target must be at least 1.' })
  @Max(100_000_000)
  target?: number | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(60)
  tech?: string | null;

  @IsOptional() @IsDateString()
  startDate?: string | null;

  @IsOptional() @IsDateString()
  endDate?: string | null;

  /** Set to make a team goal on that shared list. Leave out for a personal goal. */
  @IsOptional() @IsString() @MaxLength(40)
  spaceId?: string | null;
}

export class UpdateGoalDto extends PartialType(OmitType(CreateGoalDto, ['spaceId'] as const)) {
  @IsOptional() @IsBoolean()
  done?: boolean;
}
