import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module';
import { HackathonsController } from './hackathons.controller';
import { HackathonsService } from './hackathons.service';

@Module({ imports: [SpacesModule], controllers: [HackathonsController], providers: [HackathonsService] })
export class HackathonsModule {}
