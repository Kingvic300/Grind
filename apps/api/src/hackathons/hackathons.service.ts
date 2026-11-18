import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { linkKey } from '../discover/scan';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';
import { ActivityService, PERSON } from '../team/activity.service';
import { CollabService } from '../team/collab.service';
import { CreateHackathonDto, UpdateHackathonDto } from './hackathon.dto';

const DATE_FIELDS = ['startDate', 'endDate', 'registrationDeadline', 'submissionDeadline'] as const;

/** Names match when they differ only in case and spacing. */
const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export type ImportSkip = { index: number; name: string | null; reason: string };

const STATUS_LABEL: Record<string, string> = {
  INTERESTED: 'Interested', REGISTERED: 'Registered', BUILDING: 'Building', SUBMITTED: 'Submitted', DONE: 'Done',
};

/** Who added it, who edited it last, who is assigned, and task and comment counts for cards. */
const INCLUDE = {
  user: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  assignees: { select: { user: { select: PERSON } } },
  tasks: { select: { done: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.HackathonInclude;

type Row = Prisma.HackathonGetPayload<{ include: typeof INCLUDE }>;

function toPublic(row: Row) {
  const { assignees, tasks, _count, ...rest } = row;
  return {
    ...rest,
    assignees: assignees.map((a) => a.user),
    taskCount: tasks.length,
    tasksDone: tasks.filter((t) => t.done).length,
    commentCount: _count.comments,
  };
}

/** Converts ISO date strings from a DTO into Date objects, keeping null as "clear this field". */
function toData(dto: UpdateHackathonDto) {
  const data: Record<string, unknown> = { ...dto };
  delete data.assigneeIds;
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
    private readonly activity: ActivityService,
    private readonly collab: CollabService,
  ) {}

  async list(userId: string, spaceId: string | null) {
    if (spaceId) await this.spaces.requireMember(userId, spaceId);
    const rows = await this.prisma.hackathon.findMany({
      where: spaceId ? { spaceId } : { userId, spaceId: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: INCLUDE,
    });
    return rows.map(toPublic);
  }

  async create(userId: string, dto: CreateHackathonDto) {
    const spaceId = dto.spaceId || null;
    if (spaceId) await this.spaces.requireMember(userId, spaceId);
    const data = toData(dto);
    delete data.spaceId;
    this.checkDates(data);
    await this.checkUnique(this.scope(userId, spaceId), dto.name, dto.url);
    // New entries go to the end of their board column.
    if (dto.position === undefined) {
      const last = await this.prisma.hackathon.aggregate({ where: this.scope(userId, spaceId), _max: { position: true } });
      data.position = (last._max.position ?? 0) + 1;
    }
    const created = await this.prisma.hackathon.create({
      data: { ...(data as Prisma.HackathonUncheckedCreateInput), userId, spaceId, updatedById: userId },
      include: INCLUDE,
    });
    await this.activity.log(spaceId, userId, 'added', created);
    await this.announce(userId, spaceId);
    return toPublic(created);
  }

  /**
   * Adds many hackathons at once. Each row is validated on its own: bad rows and names already
   * in the list are reported back by their index in `rows`, and the rest are added.
   */
  async importMany(userId: string, spaceId: string | null, rows: Record<string, unknown>[]) {
    if (spaceId) await this.spaces.requireMember(userId, spaceId);
    const where = this.scope(userId, spaceId);
    const existing = await this.prisma.hackathon.findMany({ where, select: { name: true, url: true } });
    const taken = new Set(existing.map((h) => nameKey(h.name)));
    const takenLinks = new Set(existing.flatMap((h) => (h.url ? [linkKey(h.url)] : [])));
    const last = await this.prisma.hackathon.aggregate({ where, _max: { position: true } });
    let position = last._max.position ?? 0;

    const skipped: ImportSkip[] = [];
    const data: Prisma.HackathonCreateManyInput[] = [];
    for (const [index, row] of rows.entries()) {
      const dto = plainToInstance(CreateHackathonDto, { ...row, spaceId: undefined, position: undefined });
      const errors = await validate(dto, { whitelist: true });
      const name = typeof dto.name === 'string' ? dto.name.trim() : null;
      if (errors.length) {
        const first = errors[0].constraints ? Object.values(errors[0].constraints)[0] : 'This row is not valid.';
        skipped.push({ index, name, reason: first });
        continue;
      }
      const key = nameKey(dto.name);
      const link = dto.url ? linkKey(dto.url) : null;
      if (taken.has(key) || (link && takenLinks.has(link))) {
        skipped.push({ index, name, reason: 'Already in this list.' });
        continue;
      }
      const fields = toData(dto);
      try {
        this.checkDates(fields);
      } catch (error) {
        skipped.push({ index, name, reason: (error as Error).message });
        continue;
      }
      taken.add(key);
      if (link) takenLinks.add(link);
      position += 1;
      data.push({ ...(fields as Prisma.HackathonUncheckedCreateInput), name: dto.name.trim(), position, userId, spaceId, updatedById: userId });
    }

    if (data.length) {
      await this.prisma.hackathon.createMany({ data });
      await this.activity.log(spaceId, userId, 'imported', null, String(data.length));
      await this.announce(userId, spaceId);
    }
    return { created: data.length, skipped };
  }

  async update(userId: string, id: string, dto: UpdateHackathonDto) {
    const current = await this.findEditable(userId, id);
    const data = toData(dto);
    this.checkDates({ ...current, ...data });
    const renamed = dto.name !== undefined && nameKey(dto.name) !== nameKey(current.name);
    const relinked = dto.url !== undefined && (dto.url ? linkKey(dto.url) : null) !== (current.url ? linkKey(current.url) : null);
    if (renamed || relinked) {
      await this.checkUnique(
        { ...this.scope(current.userId, current.spaceId), id: { not: id } },
        renamed ? dto.name! : null,
        relinked ? dto.url : null,
      );
    }

    let added: string[] = [];
    if (dto.assigneeIds) {
      const ids = [...new Set(dto.assigneeIds)];
      await this.collab.checkAssignable(current, ids);
      const before = current.assignees.map((a) => a.userId);
      added = ids.filter((x) => !before.includes(x));
      await this.prisma.$transaction([
        this.prisma.hackathonAssignee.deleteMany({ where: { hackathonId: id, userId: { notIn: ids } } }),
        this.prisma.hackathonAssignee.createMany({ data: added.map((u) => ({ hackathonId: id, userId: u })), skipDuplicates: true }),
      ]);
    }

    const updated = await this.prisma.hackathon.update({
      where: { id },
      data: { ...(data as Prisma.HackathonUncheckedUpdateInput), updatedById: userId },
      include: INCLUDE,
    });

    if (current.spaceId) {
      if (dto.status && dto.status !== current.status) {
        await this.activity.log(current.spaceId, userId, 'moved', updated, STATUS_LABEL[dto.status]);
      }
      if (added.length) {
        const names = updated.assignees.filter((a) => added.includes(a.user.id)).map((a) => a.user.name);
        await this.activity.log(current.spaceId, userId, 'assigned', updated, names.join(', '));
      }
      // Board moves also send position, so only other fields count as an edit.
      const edited = Object.keys(data).some((k) => k !== 'status' && k !== 'position');
      if (edited) await this.activity.log(current.spaceId, userId, 'edited', updated);
    }
    await this.announce(userId, current.spaceId);
    return toPublic(updated);
  }

  async remove(userId: string, id: string) {
    const current = await this.findEditable(userId, id);
    await this.prisma.hackathon.delete({ where: { id } });
    await this.activity.log(current.spaceId, userId, 'deleted', null, current.name);
    await this.announce(userId, current.spaceId);
  }

  /** Private entries are editable by their owner. Team entries by every member of the team. */
  private async findEditable(userId: string, id: string) {
    const current = await this.prisma.hackathon.findFirst({
      where: { id, OR: [{ userId, spaceId: null }, { space: { members: { some: { userId } } } }] },
      include: { assignees: { select: { userId: true } } },
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

  /**
   * Stops the same hackathon going into one list twice. A hackathon matches when its name matches
   * (ignoring case and spacing) or its link matches (ignoring scheme, www, query and trailing slash).
   */
  private async checkUnique(where: Prisma.HackathonWhereInput, name: string | null | undefined, url: string | null | undefined) {
    if (!name && !url) return;
    const rows = await this.prisma.hackathon.findMany({ where, select: { name: true, url: true } });
    const key = name ? nameKey(name) : null;
    const link = url ? linkKey(url) : null;
    const match = rows.find((h) => (key && nameKey(h.name) === key) || (link && h.url && linkKey(h.url) === link));
    if (match) throw new ConflictException(`${match.name} is already in this list.`);
  }

  private checkDates(data: Record<string, unknown>) {
    const start = data.startDate as Date | null | undefined;
    const end = data.endDate as Date | null | undefined;
    if (start && end && end < start) throw new BadRequestException('The end date is before the start date.');
  }
}
