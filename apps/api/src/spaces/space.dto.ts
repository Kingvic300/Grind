import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SpaceNameDto {
  @Transform(trim)
  @IsString()
  @Length(1, 60, { message: 'Give the team a name of up to 60 characters.' })
  name: string;
}
