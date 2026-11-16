import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CollabService } from './collab.service';
import { TeamController } from './team.controller';

@Module({ controllers: [TeamController], providers: [ActivityService, CollabService], exports: [ActivityService, CollabService] })
export class TeamModule {}
