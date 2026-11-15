import { Module } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { RemindersService } from './reminders.service';

@Module({ providers: [RemindersService, MailService] })
export class RemindersModule {}
