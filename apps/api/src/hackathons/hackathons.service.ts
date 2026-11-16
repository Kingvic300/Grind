import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';
import { CreateHackathonDto, UpdateHackathonDto } from './hackathon.dto';

const DATE_FIELDS = ['startDate', 'endDate', 'registrationDeadline', 'submissionDeadline'] as const;

/** Who added and who last edited the entry, shown in shared lists. */
const PEOPLE = {
  user: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
} as const;

/** Converts ISO date strings from a DTO into Date objects, keeping null as "clear this field". */
function toData(dto: UpdateHackathonDto) {
  const data: Record<string, unknown> = { ...dto };
  for (const field of DATE_FIELDS) {
    const value = dto[field];
    if (value !== undefined) data[field] = value ? new Date(value) : null;
  }
  return data;
}

@Injectable()
export class HackathonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
    private readonly events: EventsService,
  ) {}

  async list(userId: string, spaceId: string | null) {
    if (spaceId) await this.spaces.requireMember(userId, spaceId);
    return this.prisma.hackathon.findMany({
      where: spaceId ? { spaceId } : { userId, spaceId: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: PEOPLE,
    });
  }

  async create(userId: string, dto: CreateHackathonDto) {
    const spaceId = dto.spaceId || null;
    if (spaceId) await this.spaces.requireMember(userId, spaceId);
    const data = toData(dto);
    delete data.spaceId;
    this.checkDates(data);
    // New entries go to the end of their board column.
    if (dto.position === undefined) {
      const last = await this.prisma.hackathon.aggregate({ where: this.scope(userId, spaceId), _max: { position: true } });
      data.position = (last._max.position ?? 0) + 1;
    }
    const created = await this.prisma.hackathon.create({
      data: { ...(data as Prisma.HackathonUncheckedCreateInput), userId, spaceId, updatedById: userId },
      include: PEOPLE,
    });
    await this.announce(userId, spaceId);
    return created;
  }

  async update(userId: string, id: string, dto: UpdateHackathonDto) {
    const current = await this.findEditable(userId, id);
    const data = toData(dto);
    this.checkDates({ ...current, ...data });
    const updated = await this.prisma.hackathon.update({
      where: { id },
      data: { ...(data as Prisma.HackathonUncheckedUpdateInput), updatedById: userId },
      include: PEOPLE,
    });
    await this.announce(userId, current.spaceId);
    return updated;
  }

  async remove(userId: string, id: string) {
    const current = await this.findEditable(userId, id);
    await this.prisma.hackathon.delete({ where: { id } });
    await this.announce(userId, current.spaceId);
  }

  /** Private entries are editable by their owner. Shared entries by every member of the list. */
  private async findEditable(userId: string, id: string) {
    const current = await this.prisma.hackathon.findFirst({
      where: { id, OR: [{ userId, spaceId: null }, { space: { members: { some: { userId } } } }] },
    });
    if (!current) throw new NotFoundException('That hackathon does not exist.');
    return current;
  }

  private scope(userId: string, spaceId: string | null): Prisma.HackathonWhereInput {
    return spaceId ? { spaceId } : { userId, spaceId: null };
  }

  /** Tells every open browser that can see this list to refetch it. */
  private async announce(userId: string, spaceId: string | null) {
    const userIds = spaceId ? await this.spaces.memberIds(spaceId) : [userId];
    this.events.notify(userIds, { type: 'hackathons', spaceId });
  }

  private checkDates(data: Record<string, unknown>) {
    const start = data.startDate as Date | null | undefined;
    const end = data.endDate as Date | null | undefined;
    if (start && end && end < start) throw new BadRequestException('The end date is before the start date.');
  }
}
