import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({ imports: [SpacesModule], controllers: [GoalsController], providers: [GoalsService] })
export class GoalsModule {}
