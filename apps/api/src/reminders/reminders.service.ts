import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Status } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const HOUR = 60 * 60 * 1000;

type Rule = {
  kind: string;
  field: 'submissionDeadline' | 'registrationDeadline';
  /** Send when the deadline is between minHours and maxHours away. */
  minHours: number;
  maxHours: number;
  /** Only remind while the hackathon is still in one of these statuses. */
  statuses: Status[];
  label: string;
  /** Kinds to mark as sent too, so an earlier reminder is not sent after a later one. */
  supersedes: string[];
};

const OPEN: Status[] = [Status.INTERESTED, Status.REGISTERED, Status.BUILDING];

const RULES: Rule[] = [
  { kind: 'submission:24h', field: 'submissionDeadline', minHours: 0, maxHours: 24, statuses: OPEN, label: 'Submission closes', supersedes: ['submission:72h'] },
  { kind: 'submission:72h', field: 'submissionDeadline', minHours: 24, maxHours: 72, statuses: OPEN, label: 'Submission closes', supersedes: [] },
  { kind: 'registration:24h', field: 'registrationDeadline', minHours: 0, maxHours: 24, statuses: [Status.INTERESTED], label: 'Registration closes', supersedes: [] },
];

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function timeLeft(ms: number): string {
  const hours = Math.max(1, Math.round(ms / HOUR));
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${Math.round(hours / 24)} days`;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendDue() {
    if (this.running) return;
    this.running = true;
    try {
      for (const rule of RULES) await this.runRule(rule);
    } catch (error) {
      this.logger.error(`Reminder run failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async runRule(rule: Rule) {
    const now = Date.now();
    const due = await this.prisma.hackathon.findMany({
      where: {
        [rule.field]: { gt: new Date(now + rule.minHours * HOUR), lte: new Date(now + rule.maxHours * HOUR) },
        status: { in: rule.statuses },
        reminders: { none: { kind: rule.kind } },
      },
      include: {
        user: { select: { email: true, emailReminders: true } },
        space: { select: { name: true, members: { select: { user: { select: { email: true, emailReminders: true } } } } } },
      },
      take: 200,
    });

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    for (const hackathon of due) {
      // Shared entries go to every member of the list. Private entries to their owner.
      const people = hackathon.space ? hackathon.space.members.map((m) => m.user) : [hackathon.user];
      const recipients = people.filter((p) => p.emailReminders).map((p) => p.email);
      const deadline = hackathon[rule.field] as Date;
      const left = timeLeft(deadline.getTime() - now);
      const when = deadline.toUTCString();
      const subject = `${rule.label} in ${left}: ${hackathon.name}`;
      const text = `${rule.label} in ${left} for ${hackathon.name}.\n\nDeadline: ${when}\n\nOpen Grind: ${appUrl}/app\n\nTurn these emails off in Settings.`;
      const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#12141C">
<p style="font-size:13px;color:#5F6578;margin:0 0 8px">${escapeHtml(hackathon.name)}${hackathon.space ? ` in ${escapeHtml(hackathon.space.name)}` : ''}</p>
<h1 style="font-size:24px;line-height:1.2;margin:0 0 12px">${rule.label} in ${left}</h1>
<p style="margin:0 0 20px;color:#5F6578">Deadline: ${when}</p>
<a href="${appUrl}/app" style="display:inline-block;background:#F2541B;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px">Open Grind</a>
<p style="font-size:12px;color:#5F6578;margin:24px 0 0">Turn these emails off in Settings.</p></div>`;

      // Log the reminder once any recipient got it, so a single bad address cannot cause repeat sends.
      let sent = !recipients.length;
      for (const to of recipients) {
        if (await this.mail.send(to, subject, text, html)) sent = true;
      }
      if (!sent) continue;
      await this.prisma.reminderLog.createMany({
        data: [rule.kind, ...rule.supersedes].map((kind) => ({ hackathonId: hackathon.id, kind })),
        skipDuplicates: true,
      });
    }
    if (due.length) this.logger.log(`${rule.kind}: processed ${due.length}`);
  }
}
