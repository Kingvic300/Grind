import { Injectable, NotFoundException } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';

export type ActivityKind =
  | 'added' | 'moved' | 'edited' | 'deleted' | 'assigned'
  | 'task_added' | 'task_done' | 'commented' | 'joined' | 'left' | 'renamed' | 'imported';

/** Repeated edits by one person to one hackathon inside this window become one entry. */
const MERGE_MS = 10 * 60_000;

export const PERSON = { id: true, name: true, avatarUrl: true, avatarColor: true } as const;

/** Team activity feed. Only teams have one; private lists log nothing. */
@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async log(
    spaceId: string | null,
    actorId: string,
    kind: ActivityKind,
    hackathon?: { id: string; name: string } | null,
    detail?: string | null,
  ) {
    if (!spaceId) return;
    if (kind === 'edited' && hackathon) {
      const recent = await this.prisma.activity.findFirst({
        where: { spaceId, actorId, hackathonId: hackathon.id, kind, createdAt: { gt: new Date(Date.now() - MERGE_MS) } },
        orderBy: { createdAt: 'desc' },
      });
      if (recent) {
        await this.prisma.activity.update({ where: { id: recent.id }, data: { createdAt: new Date(), hackathonName: hackathon.name } });
        return this.announce(spaceId);
      }
    }
    await this.prisma.activity.create({
      data: { spaceId, actorId, kind, hackathonId: hackathon?.id ?? null, hackathonName: hackathon?.name ?? null, detail: detail ?? null },
    });
    await this.announce(spaceId);
  }

  async list(userId: string, spaceId: string, before?: string) {
    const member = await this.prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
    if (!member) throw new NotFoundException('That team does not exist, or you are not in it.');
    const cursor = before ? new Date(before) : undefined;
    return this.prisma.activity.findMany({
      where: { spaceId, ...(cursor && !Number.isNaN(cursor.getTime()) ? { createdAt: { lt: cursor } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, kind: true, detail: true, hackathonId: true, hackathonName: true, createdAt: true, actor: { select: PERSON } },
    });
  }

  private async announce(spaceId: string) {
    const rows = await this.prisma.spaceMember.findMany({ where: { spaceId }, select: { userId: true } });
    this.events.notify(rows.map((r) => r.userId), { type: 'activity', spaceId });
  }
}
