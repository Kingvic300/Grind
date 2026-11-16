import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { User } from '@prisma/client';
import { DiscoverService } from '../discover/discover.service';
import type { Listing } from '../discover/sources';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const when = (d: Date) => d.toUTCString().replace(/:\d\d GMT$/, ' UTC');

/** True when a Discover listing fits the user's saved interests. */
export function matchesInterests(h: Listing, u: Pick<User, 'interestKind' | 'interestTopics' | 'interestStack' | 'interestFormat'>): boolean {
  const web3 = h.categories.includes('web3');
  if (u.interestKind === 'web3' && !web3) return false;
  if (u.interestKind === 'web2' && web3) return false;
  if (u.interestFormat && h.format !== u.interestFormat) return false;
  const wantsTopics = u.interestTopics.length > 0;
  const wantsStack = u.interestStack.length > 0;
  if (!wantsTopics && !wantsStack) return u.interestKind !== 'any' || Boolean(u.interestFormat);
  return (
    (wantsTopics && u.interestTopics.some((t) => (h.categories as string[]).includes(t))) ||
    (wantsStack && u.interestStack.some((s) => h.stack.includes(s)))
  );
}

/** Monday morning email: deadlines in the next 7 days, plus new Discover matches. */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly discover: DiscoverService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 8 * * 1')
  async sendWeekly() {
    const users = await this.prisma.user.findMany({
      where: { weeklyDigest: true, OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: new Date(Date.now() - 6 * DAY) } }] },
      take: 500,
    });
    if (!users.length) return;
    const listings = await this.discover.list().then((r) => r.hackathons).catch(() => [] as Listing[]);
    for (const user of users) {
      try {
        if (await this.sendTo(user, listings)) {
          await this.prisma.user.update({ where: { id: user.id }, data: { lastDigestAt: new Date() } });
        }
      } catch (error) {
        this.logger.warn(`Digest for ${user.id} failed: ${(error as Error).message}`);
      }
    }
  }

  private async sendTo(user: User, listings: Listing[]): Promise<boolean> {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * DAY);
    const hackathons = await this.prisma.hackathon.findMany({
      where: {
        OR: [{ userId: user.id, spaceId: null }, { space: { members: { some: { userId: user.id } } } }],
        status: { notIn: ['SUBMITTED', 'DONE'] },
      },
      include: { space: { select: { name: true } } },
    });
    const due: { name: string; label: string; at: Date; list: string | null }[] = [];
    for (const h of hackathons) {
      if (h.submissionDeadline && h.submissionDeadline > now && h.submissionDeadline <= week)
        due.push({ name: h.name, label: 'Submission closes', at: h.submissionDeadline, list: h.space?.name ?? null });
      if (h.registrationDeadline && h.status === 'INTERESTED' && h.registrationDeadline > now && h.registrationDeadline <= week)
        due.push({ name: h.name, label: 'Registration closes', at: h.registrationDeadline, list: h.space?.name ?? null });
    }
    due.sort((a, b) => a.at.getTime() - b.at.getTime());

    const tracked = new Set(hackathons.map((h) => (h.url ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')));
    const picks = listings
      .filter((l) => matchesInterests(l, user) && !tracked.has(l.url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')))
      .slice(0, 5);
    if (!due.length && !picks.length) return false;

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    const subject = due.length ? `This week: ${due.length} deadline${due.length === 1 ? '' : 's'}` : `This week: ${picks.length} hackathons for you`;
    const text = [
      'Your week in Grind',
      '',
      ...(due.length ? ['Deadlines in the next 7 days:', ...due.map((d) => `- ${d.label}: ${d.name}${d.list ? ` (${d.list})` : ''}, ${when(d.at)}`), ''] : []),
      ...(picks.length ? ['Hackathons that match your interests:', ...picks.map((p) => `- ${p.name}: ${p.url}`), ''] : []),
      `Open Grind: ${appUrl}/app`,
      'Turn this email off in Settings, Notifications.',
    ].join('\n');
    const row = (title: string, sub: string, href?: string) =>
      `<tr><td style="padding:10px 0;border-top:1px solid #E4E7EE"><div style="font-weight:600">${href ? `<a href="${escapeHtml(href)}" style="color:#12141C">${escapeHtml(title)}</a>` : escapeHtml(title)}</div><div style="font-size:13px;color:#5F6578">${escapeHtml(sub)}</div></td></tr>`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#12141C">
<p style="font-family:monospace;font-size:13px;color:#5F6578;margin:0 0 8px"><span style="color:#F2541B">&gt;</span> grind week</p>
<h1 style="font-size:24px;line-height:1.2;margin:0 0 18px">Your week in Grind</h1>
${due.length ? `<h2 style="font-size:16px;margin:0 0 4px">Deadlines in the next 7 days</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px">${due.map((d) => row(d.name, `${d.label} ${when(d.at)}${d.list ? ` · ${d.list}` : ''}`)).join('')}</table>` : ''}
${picks.length ? `<h2 style="font-size:16px;margin:0 0 4px">Hackathons that match your interests</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px">${picks.map((p) => row(p.name, [p.organizer, p.prize].filter(Boolean).join(' · ') || 'Open the link for details', p.url)).join('')}</table>` : ''}
<a href="${appUrl}/app" style="display:inline-block;background:#F2541B;color:#12141C;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px">Open Grind</a>
<p style="font-size:12px;color:#5F6578;margin:24px 0 0">Turn this email off in Settings, Notifications.</p></div>`;
    return this.mail.send(user.email, subject, text, html);
  }
}
