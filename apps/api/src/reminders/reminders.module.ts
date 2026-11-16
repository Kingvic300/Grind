import { Module } from '@nestjs/common';
import { DiscoverModule } from '../discover/discover.module';
import { MailService } from '../mail/mail.service';
import { DigestService } from './digest.service';
import { RemindersService } from './reminders.service';

@Module({ imports: [DiscoverModule], providers: [RemindersService, DigestService, MailService] })
export class RemindersModule {}
