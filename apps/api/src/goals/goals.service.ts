import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Goal, GoalKind, Prisma, Status } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';
import { CreateGoalDto, UpdateGoalDto } from './goal.dto';

/** What a goal needs to know about each hackathon to count it. */
const COUNTED = {
  id: true, name: true, status: true, won: true, prizeAmount: true, techStack: true, startDate: true, endDate: true, createdAt: true,
} satisfies Prisma.HackathonSelect;

type Counted = Prisma.HackathonGetPayload<{ select: typeof COUNTED }>;

const ENTERED: Status[] = [Status.REGISTERED, Status.BUILDING, Status.SUBMITTED, Status.DONE];
const SUBMITTED: Status[] = [Status.SUBMITTED, Status.DONE];

/** "2027-03-14" for a stored moment. Hackathon and goal dates are stored at UTC midnight. */
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** The day a hackathon counts on: when it ends, else when it starts, else when it was added. */
const countedDay = (h: Counted) => dayKey(h.endDate ?? h.startDate ?? h.createdAt);

function inWindow(goal: Goal, h: Counted) {
  const day = countedDay(h);
  if (goal.startDate && day < dayKey(goal.startDate)) return false;
  if (goal.endDate && day > dayKey(goal.endDate)) return false;
  return true;
}

/** True when the hackathon adds to the goal. PRIZE goals add its prize amount instead of 1. */
function counts(goal: Goal, h: Counted) {
  switch (goal.kind) {
    case GoalKind.ENTER: return ENTERED.includes(h.status);
    case GoalKind.SUBMIT: return SUBMITTED.includes(h.status);
    case GoalKind.WIN: return h.won;
    case GoalKind.PRIZE: return (h.prizeAmount ?? 0) > 0;
    case GoalKind.TECH: {
      const tech = goal.tech?.toLowerCase();
      return Boolean(tech) && h.status !== Status.INTERESTED && h.techStack.some((t) => t.toLowerCase() === tech);
    }
    default: return false;
  }
}

/** The goal with its progress and the hackathons that count toward it. */
export function withProgress(goal: Goal, hackathons: Counted[]) {
  if (goal.kind === GoalKind.CUSTOM) return { ...goal, progress: goal.done ? 1 : 0, counted: [] };
  const matched = hackathons.filter((h) => inWindow(goal, h) && counts(goal, h));
  const progress = goal.kind === GoalKind.PRIZE ? matched.reduce((sum, h) => sum + (h.prizeAmount ?? 0), 0) : matched.length;
  return { ...goal, progress, counted: matched.map((h) => ({ id: h.id, name: h.name })) };
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
    private readonly events: EventsService,
  ) {}

  async list(userId: string, spaceId: string | null) {
    if (spaceId) await this.spaces.requireMember(userId, spaceId);
    const goals = await this.prisma.goal.findMany({
      where: { OR: [{ userId, spaceId: null }, ...(spaceId ? [{ spaceId }] : [])] },
      orderBy: { createdAt: 'asc' },
    });
    if (!goals.length) return [];
    const personal = goals.some((g) => !g.spaceId) ? await this.personalHackathons(userId) : [];
    const team = spaceId && goals.some((g) => g.spaceId) ? await this.teamHackathons(spaceId) : [];
    return goals.map((g) => withProgress(g, g.spaceId ? team : personal));
  }

  async create(userId: string, dto: CreateGoalDto) {
    const spaceId = dto.spaceId || null;
    if (spaceId) await this.spaces.requireMember(userId, spaceId);
    const data = this.toData(dto);
    this.check({ kind: dto.kind, title: null, target: null, tech: null, startDate: null, endDate: null, ...data } as Goal);
    const goal = await this.prisma.goal.create({ data: { ...(data as Prisma.GoalUncheckedCreateInput), kind: dto.kind, userId, spaceId } });
    await this.announce(userId, spaceId);
    return this.single(userId, goal);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto) {
    const current = await this.findEditable(userId, id);
    const data = this.toData(dto);
    this.check({ ...current, ...data } as Goal);
    const goal = await this.prisma.goal.update({ where: { id }, data: data as Prisma.GoalUncheckedUpdateInput });
    await this.announce(userId, current.spaceId);
    return this.single(userId, goal);
  }

  async remove(userId: string, id: string) {
    const current = await this.findEditable(userId, id);
    await this.prisma.goal.delete({ where: { id } });
    await this.announce(userId, current.spaceId);
  }

  private async single(userId: string, goal: Goal) {
    const hackathons = goal.spaceId ? await this.teamHackathons(goal.spaceId) : await this.personalHackathons(userId);
    return withProgress(goal, hackathons);
  }

  /** The private list, plus shared-list hackathons the user added or is assigned to. */
  private personalHackathons(userId: string) {
    return this.prisma.hackathon.findMany({
      where: {
        OR: [
          { userId, spaceId: null },
          {
            space: { members: { some: { userId } } },
            OR: [{ userId }, { assignees: { some: { userId } } }],
          },
        ],
      },
      select: COUNTED,
    });
  }

  private teamHackathons(spaceId: string) {
    return this.prisma.hackathon.findMany({ where: { spaceId }, select: COUNTED });
  }

  /** Personal goals are editable by their owner. Team goals by every member of the team. */
  private async findEditable(userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, OR: [{ userId, spaceId: null }, { space: { members: { some: { userId } } } }] },
    });
    if (!goal) throw new NotFoundException('That goal does not exist.');
    return goal;
  }

  private toData(dto: UpdateGoalDto) {
    const data: Record<string, unknown> = { ...dto };
    delete data.spaceId;
    for (const field of ['startDate', 'endDate'] as const) {
      const value = dto[field];
      if (value !== undefined) data[field] = value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
    }
    if (typeof dto.title === 'string' && !dto.title) data.title = null;
    if (typeof dto.tech === 'string' && !dto.tech) data.tech = null;
    return data;
  }

  /** Each kind needs different fields. */
  private check(goal: Goal) {
    if (goal.kind === GoalKind.CUSTOM) {
      if (!goal.title) throw new BadRequestException('Write what the goal is.');
    } else if (!goal.target) {
      throw new BadRequestException(goal.kind === GoalKind.PRIZE ? 'Set how many dollars to aim for.' : 'Set how many hackathons to aim for.');
    }
    if (goal.kind === GoalKind.TECH && !goal.tech) throw new BadRequestException('Name the technology to count.');
    if (goal.startDate && goal.endDate && goal.endDate < goal.startDate) {
      throw new BadRequestException('The end date is before the start date.');
    }
  }

  /** Tells every open browser that can see this goal to refetch goals. */
  private async announce(userId: string, spaceId: string | null) {
    const userIds = spaceId ? await this.spaces.memberIds(spaceId) : [userId];
    this.events.notify(userIds, { type: 'goals' });
  }
}
