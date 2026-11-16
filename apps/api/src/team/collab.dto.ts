import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTaskDto {
  @Transform(trim) @IsString() @Length(1, 200, { message: 'Give the task a title of up to 200 characters.' })
  title: string;

  @IsOptional() @IsString() @MaxLength(40)
  assigneeId?: string | null;
}

export class UpdateTaskDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 200, { message: 'Give the task a title of up to 200 characters.' })
  title?: string;

  @IsOptional() @IsBoolean()
  done?: boolean;

  @IsOptional() @IsString() @MaxLength(40)
  assigneeId?: string | null;
}

export class CreateCommentDto {
  @Transform(trim) @IsString() @Length(1, 4000, { message: 'Write a comment of up to 4000 characters.' })
  body: string;
}
