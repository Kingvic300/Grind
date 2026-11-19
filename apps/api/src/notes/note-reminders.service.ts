import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;
const PERSON = { email: true, emailReminders: true } as const;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** First line of the note, short enough for a subject line. */
function headline(body: string | null, url: string | null) {
  const line = body?.split('\n').find((l) => l.trim())?.trim();
  const text = line || (url ? url.replace(/^https?:\/\/(www\.)?/i, '') : 'Your note');
  return text.length > 70 ? `${text.slice(0, 67)}...` : text;
}

/**
 * Emails note reminders when they come due. Checked every minute so reminders arrive close to
 * the time set. Reminders more than a day late (the server was down, or the time was set in the
 * past) are marked done without an email: the note still shows as due in the app.
 */
@Injectable()
export class NoteRemindersService {
  private readonly logger = new Logger(NoteRemindersService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDue() {
    if (this.running) return;
    this.running = true;
    try {
      await this.run();
    } catch (error) {
      this.logger.error(`Note reminder run failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async run() {
    const now = new Date();
    await this.prisma.note.updateMany({
      where: { remindAt: { lt: new Date(now.getTime() - DAY) }, remindedAt: null },
      data: { remindedAt: now },
    });

    const due = await this.prisma.note.findMany({
      where: { remindAt: { lte: now }, remindedAt: null, done: false },
      include: {
        user: { select: PERSON },
        space: { select: { name: true, members: { select: { user: { select: PERSON } } } } },
      },
      take: 200,
    });

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    for (const note of due) {
      // Claim the note first, so a slow send cannot lead to a second email on the next run.
      const { count } = await this.prisma.note.updateMany({ where: { id: note.id, remindedAt: null }, data: { remindedAt: now } });
      if (!count) continue;

      const people = note.space ? note.space.members.map((m) => m.user) : [note.user];
      const recipients = people.filter((p) => p.emailReminders).map((p) => p.email);
      if (!recipients.length) continue;

      const title = headline(note.body, note.url);
      const where = note.space ? ` in ${note.space.name}` : '';
      const subject = `Reminder: ${title}`;
      const text = [
        `Reminder from your Grind notes${where}.`,
        note.body ?? '',
        note.url ? `Link: ${note.url}` : '',
        `Open your notes: ${appUrl}/app/notes`,
        'Turn reminder emails off in Settings.',
      ].filter(Boolean).join('\n\n');
      const body = note.body ? escapeHtml(note.body).replace(/\n/g, '<br>') : '';
      const link = note.url ? escapeHtml(note.url) : '';
      const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#12141C">
<p style="font-size:13px;color:#5F6578;margin:0 0 8px">Reminder from your notes${escapeHtml(where)}</p>
${body ? `<p style="font-size:17px;line-height:1.5;margin:0 0 16px">${body}</p>` : ''}
${link ? `<p style="margin:0 0 20px;word-break:break-all"><a href="${link}" style="color:#C2410C">${link}</a></p>` : ''}
<a href="${appUrl}/app/notes" style="display:inline-block;background:#F2541B;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px">Open notes</a>
<p style="font-size:12px;color:#5F6578;margin:24px 0 0">Turn reminder emails off in Settings.</p></div>`;
      let sent = false;
      for (const to of recipients) {
        if (await this.mail.send(to, subject, text, html)) sent = true;
      }
      // Nobody got it (mail is down): release the note so the next run tries again.
      if (!sent) await this.prisma.note.update({ where: { id: note.id }, data: { remindedAt: null } });
    }
    if (due.length) this.logger.log(`note reminders: processed ${due.length}`);
  }
}
