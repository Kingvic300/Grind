import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';
import { ActivityService, PERSON } from '../team/activity.service';
import { CollabService } from '../team/collab.service';
import { CreateHackathonDto, UpdateHackathonDto } from './hackathon.dto';

const DATE_FIELDS = ['startDate', 'endDate', 'registrationDeadline', 'submissionDeadline'] as const;

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

  async update(userId: string, id: string, dto: UpdateHackathonDto) {
    const current = await this.findEditable(userId, id);
    const data = toData(dto);
    this.checkDates({ ...current, ...data });

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

  private checkDates(data: Record<string, unknown>) {
    const start = data.startDate as Date | null | undefined;
    const end = data.endDate as Date | null | undefined;
    if (start && end && end < start) throw new BadRequestException('The end date is before the start date.');
  }
}
