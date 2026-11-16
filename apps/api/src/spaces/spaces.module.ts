import { Module } from '@nestjs/common';
import { TeamModule } from '../team/team.module';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({ imports: [TeamModule], controllers: [SpacesController], providers: [SpacesService], exports: [SpacesService] })
export class SpacesModule {}
