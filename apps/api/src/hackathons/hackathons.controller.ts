import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { CreateHackathonDto, UpdateHackathonDto } from './hackathon.dto';
import { HackathonsService } from './hackathons.service';

@UseGuards(AuthGuard)
@Controller('hackathons')
export class HackathonsController {
  constructor(private readonly hackathons: HackathonsService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.hackathons.list(userId);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateHackathonDto) {
    return this.hackathons.create(userId, dto);
  }

  @Patch(':id')
  update(@UserId() userId: string, @Param('id') id: string, @Body() dto: UpdateHackathonDto) {
    return this.hackathons.update(userId, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@UserId() userId: string, @Param('id') id: string) {
    return this.hackathons.remove(userId, id);
  }
}
