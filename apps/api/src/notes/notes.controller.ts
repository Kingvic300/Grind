import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { CreateNoteDto, UpdateNoteDto } from './note.dto';
import { NotesService } from './notes.service';

@UseGuards(AuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  /** Personal notes, plus the team notes of ?space=<id> when given. */
  @Get()
  list(@UserId() userId: string, @Query('space') spaceId?: string) {
    return this.notes.list(userId, spaceId || null);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateNoteDto) {
    return this.notes.create(userId, dto);
  }

  @Patch(':id')
  update(@UserId() userId: string, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(userId, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@UserId() userId: string, @Param('id') id: string) {
    return this.notes.remove(userId, id);
  }
}
