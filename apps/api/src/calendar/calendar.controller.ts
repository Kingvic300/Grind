import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { buildIcs, type IcsEvent } from './ics';

const nextDay = (key: string) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Private calendar feed. Calendar apps cannot send the login cookie, so the secret token in
 * the link is the credential. Users can turn the feed off or replace the link in Settings.
 */
@Controller('calendar')
export class CalendarController {
  constructor(private readonly prisma: PrismaService) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':file')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Cache-Control', 'private, max-age=900')
  async feed(@Param('file') file: string) {
    const token = file.replace(/\.ics$/, '');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException();
    const user = await this.prisma.user.findUnique({ where: { calendarToken: token }, select: { id: true } });
    if (!user) throw new NotFoundException();

    const hackathons = await this.prisma.hackathon.findMany({
      where: { OR: [{ userId: user.id, spaceId: null }, { space: { members: { some: { userId: user.id } } } }] },
      include: { space: { select: { name: true } } },
    });

    const events: IcsEvent[] = [];
    for (const h of hackathons) {
      const where = h.space ? ` (${h.space.name})` : '';
      const start = (h.startDate ?? h.endDate)?.toISOString().slice(0, 10);
      const end = (h.endDate ?? h.startDate)?.toISOString().slice(0, 10);
      if (start && end) {
        events.push({ uid: `${h.id}-event@grind`, title: `${h.name}${where}`, url: h.url, allDay: true, start, endExclusive: nextDay(end) });
      }
      if (h.registrationDeadline && h.status === 'INTERESTED') {
        events.push({ uid: `${h.id}-reg@grind`, title: `Registration closes: ${h.name}`, url: h.url, allDay: false, at: h.registrationDeadline, alarmMinutes: [1440] });
      }
      if (h.submissionDeadline && h.status !== 'SUBMITTED' && h.status !== 'DONE') {
        events.push({ uid: `${h.id}-sub@grind`, title: `Submission closes: ${h.name}`, url: h.url, allDay: false, at: h.submissionDeadline, alarmMinutes: [1440, 120] });
      }
    }
    return buildIcs('Grind hackathons', events);
  }
}
