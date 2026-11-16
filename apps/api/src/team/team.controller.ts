import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { ActivityService } from './activity.service';
import { CreateCommentDto, CreateTaskDto, UpdateTaskDto } from './collab.dto';
import { CollabService } from './collab.service';

@UseGuards(AuthGuard)
@Controller()
export class TeamController {
  constructor(
    private readonly collab: CollabService,
    private readonly activity: ActivityService,
  ) {}

  /** ?before=<ISO time> pages back through older entries. */
  @Get('spaces/:id/activity')
  feed(@UserId() userId: string, @Param('id') spaceId: string, @Query('before') before?: string) {
    return this.activity.list(userId, spaceId, before);
  }

  @Get('hackathons/:id/tasks')
  tasks(@UserId() userId: string, @Param('id') id: string) {
    return this.collab.listTasks(userId, id);
  }

  @Post('hackathons/:id/tasks')
  addTask(@UserId() userId: string, @Param('id') id: string, @Body() dto: CreateTaskDto) {
    return this.collab.addTask(userId, id, dto);
  }

  @Patch('hackathons/:id/tasks/:taskId')
  updateTask(@UserId() userId: string, @Param('id') id: string, @Param('taskId') taskId: string, @Body() dto: UpdateTaskDto) {
    return this.collab.updateTask(userId, id, taskId, dto);
  }

  @HttpCode(204)
  @Delete('hackathons/:id/tasks/:taskId')
  removeTask(@UserId() userId: string, @Param('id') id: string, @Param('taskId') taskId: string) {
    return this.collab.removeTask(userId, id, taskId);
  }

  @Get('hackathons/:id/comments')
  comments(@UserId() userId: string, @Param('id') id: string) {
    return this.collab.listComments(userId, id);
  }

  @Post('hackathons/:id/comments')
  addComment(@UserId() userId: string, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.collab.addComment(userId, id, dto.body);
  }

  @HttpCode(204)
  @Delete('hackathons/:id/comments/:commentId')
  removeComment(@UserId() userId: string, @Param('id') id: string, @Param('commentId') commentId: string) {
    return this.collab.removeComment(userId, id, commentId);
  }
}
