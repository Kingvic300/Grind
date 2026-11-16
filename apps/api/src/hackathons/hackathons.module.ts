import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module';
import { TeamModule } from '../team/team.module';
import { HackathonsController } from './hackathons.controller';
import { HackathonsService } from './hackathons.service';

@Module({ imports: [SpacesModule, TeamModule], controllers: [HackathonsController], providers: [HackathonsService] })
export class HackathonsModule {}
