import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { SpaceNameDto } from './space.dto';
import { SpacesService } from './spaces.service';

@UseGuards(AuthGuard)
@Controller('spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.spaces.list(userId);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: SpaceNameDto) {
    return this.spaces.create(userId, dto.name);
  }

  // Invite routes are throttled harder, so codes cannot be guessed in bulk.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('invite/:code')
  preview(@UserId() userId: string, @Param('code') code: string) {
    return this.spaces.preview(userId, code);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('invite/:code/join')
  join(@UserId() userId: string, @Param('code') code: string) {
    return this.spaces.join(userId, code);
  }

  @Patch(':id')
  rename(@UserId() userId: string, @Param('id') id: string, @Body() dto: SpaceNameDto) {
    return this.spaces.rename(userId, id, dto.name);
  }

  @Post(':id/invite/reset')
  resetInvite(@UserId() userId: string, @Param('id') id: string) {
    return this.spaces.resetInvite(userId, id);
  }

  @HttpCode(204)
  @Delete(':id/members/:userId')
  removeMember(@UserId() userId: string, @Param('id') id: string, @Param('userId') targetId: string) {
    return this.spaces.removeMember(userId, id, targetId);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@UserId() userId: string, @Param('id') id: string) {
    return this.spaces.remove(userId, id);
  }
}
