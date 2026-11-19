import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { CreateGoalDto, UpdateGoalDto } from './goal.dto';
import { GoalsService } from './goals.service';

@UseGuards(AuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  /** Personal goals, plus the team goals of ?space=<id> when given. */
  @Get()
  list(@UserId() userId: string, @Query('space') spaceId?: string) {
    return this.goals.list(userId, spaceId || null);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateGoalDto) {
    return this.goals.create(userId, dto);
  }

  @Patch(':id')
  update(@UserId() userId: string, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.goals.update(userId, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@UserId() userId: string, @Param('id') id: string) {
    return this.goals.remove(userId, id);
  }
}
