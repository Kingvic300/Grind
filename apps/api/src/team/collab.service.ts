import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SpaceRole } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService, PERSON } from './activity.service';
import type { CreateTaskDto, UpdateTaskDto } from './collab.dto';

const TASK_SELECT = { id: true, title: true, done: true, position: true, createdAt: true, assignee: { select: PERSON } } as const;
const snippet = (body: string) => (body.length > 120 ? `${body.slice(0, 117)}...` : body);
const COMMENT_SELECT = { id: true, body: true, createdAt: true, author: { select: PERSON } } as const;

/** Tasks and comments inside one hackathon. Anyone who can edit the hackathon can use them. */
@Injectable()
export class CollabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly activity: ActivityService,
  ) {}

  /** The hackathon, if this user may see it: their own private entry, or one in a team they are in. */
  async access(userId: string, hackathonId: string) {
    const h = await this.prisma.hackathon.findFirst({
      where: { id: hackathonId, OR: [{ userId, spaceId: null }, { space: { members: { some: { userId } } } }] },
      select: { id: true, name: true, userId: true, spaceId: true },
    });
    if (!h) throw new NotFoundException('That hackathon does not exist.');
    return h;
  }

  /** People who may be assigned: team members, or only the owner for a private entry. */
  async checkAssignable(h: { userId: string; spaceId: string | null }, ids: string[]) {
    if (!ids.length) return;
    const allowed = h.spaceId
      ? (await this.prisma.spaceMember.findMany({ where: { spaceId: h.spaceId }, select: { userId: true } })).map((m) => m.userId)
      : [h.userId];
    if (ids.some((id) => !allowed.includes(id))) throw new BadRequestException('Only people in this team can be assigned.');
  }

  listTasks(userId: string, hackathonId: string) {
    return this.access(userId, hackathonId).then(() =>
      this.prisma.task.findMany({ where: { hackathonId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: TASK_SELECT }),
    );
  }

  async addTask(userId: string, hackathonId: string, dto: CreateTaskDto) {
    const h = await this.access(userId, hackathonId);
    if (dto.assigneeId) await this.checkAssignable(h, [dto.assigneeId]);
    const count = await this.prisma.task.count({ where: { hackathonId } });
    if (count >= 100) throw new BadRequestException('A hackathon can have up to 100 tasks.');
    const last = await this.prisma.task.aggregate({ where: { hackathonId }, _max: { position: true } });
    const task = await this.prisma.task.create({
      data: { hackathonId, title: dto.title, assigneeId: dto.assigneeId || null, position: (last._max.position ?? 0) + 1 },
      select: TASK_SELECT,
    });
    await this.activity.log(h.spaceId, userId, 'task_added', h, task.title);
    await this.changed(h);
    return task;
  }

  async updateTask(userId: string, hackathonId: string, taskId: string, dto: UpdateTaskDto) {
    const h = await this.access(userId, hackathonId);
    const current = await this.prisma.task.findFirst({ where: { id: taskId, hackathonId } });
    if (!current) throw new NotFoundException('That task does not exist.');
    if (dto.assigneeId) await this.checkAssignable(h, [dto.assigneeId]);
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { title: dto.title, done: dto.done, assigneeId: dto.assigneeId === undefined ? undefined : dto.assigneeId || null },
      select: TASK_SELECT,
    });
    if (dto.done === true && !current.done) await this.activity.log(h.spaceId, userId, 'task_done', h, task.title);
    await this.changed(h);
    return task;
  }

  async removeTask(userId: string, hackathonId: string, taskId: string) {
    const h = await this.access(userId, hackathonId);
    const { count } = await this.prisma.task.deleteMany({ where: { id: taskId, hackathonId } });
    if (!count) throw new NotFoundException('That task does not exist.');
    await this.changed(h);
  }

  listComments(userId: string, hackathonId: string) {
    return this.access(userId, hackathonId).then(() =>
      this.prisma.comment.findMany({ where: { hackathonId }, orderBy: { createdAt: 'asc' }, take: 300, select: COMMENT_SELECT }),
    );
  }

  async addComment(userId: string, hackathonId: string, body: string) {
    const h = await this.access(userId, hackathonId);
    const comment = await this.prisma.comment.create({ data: { hackathonId, authorId: userId, body }, select: COMMENT_SELECT });
    await this.activity.log(h.spaceId, userId, 'commented', h, snippet(body));
    await this.changed(h);
    return comment;
  }

  /** Authors can delete their own comments. Team owners can delete any comment in the team. */
  async removeComment(userId: string, hackathonId: string, commentId: string) {
    const h = await this.access(userId, hackathonId);
    const comment = await this.prisma.comment.findFirst({ where: { id: commentId, hackathonId } });
    if (!comment) throw new NotFoundException('That comment does not exist.');
    if (comment.authorId !== userId) {
      const owner = h.spaceId
        ? await this.prisma.spaceMember.findFirst({ where: { spaceId: h.spaceId, userId, role: SpaceRole.OWNER } })
        : null;
      if (!owner) throw new ForbiddenException('You can only delete your own comments.');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    // Its text should not live on in the team feed.
    await this.prisma.activity.deleteMany({ where: { hackathonId, kind: 'commented', actorId: comment.authorId, detail: snippet(comment.body) } });
    await this.changed(h);
  }

  /** Open drawers refetch tasks and comments; board cards refetch their counts. */
  private async changed(h: { id: string; userId: string; spaceId: string | null }) {
    const userIds = h.spaceId
      ? (await this.prisma.spaceMember.findMany({ where: { spaceId: h.spaceId }, select: { userId: true } })).map((m) => m.userId)
      : [h.userId];
    this.events.notify(userIds, { type: 'detail', hackathonId: h.id });
    this.events.notify(userIds, { type: 'hackathons', spaceId: h.spaceId });
  }
}
