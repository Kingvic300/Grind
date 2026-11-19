import { Module } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { SpacesModule } from '../spaces/spaces.module';
import { NoteRemindersService } from './note-reminders.service';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({ imports: [SpacesModule], controllers: [NotesController], providers: [NotesService, NoteRemindersService, MailService] })
export class NotesModule {}
