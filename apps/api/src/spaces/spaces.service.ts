import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SpaceRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';

/** 128 random bits. Anyone with the code can join, so it must not be guessable. */
const newInviteCode = () => randomBytes(16).toString('base64url');

const SPACE_INCLUDE = {
  members: {
    orderBy: { joinedAt: 'asc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  _count: { select: { hackathons: true } },
} as const;

@Injectable()
export class SpacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  /** Throws unless the user is a member. Returns the member row. */
  async requireMember(userId: string, spaceId: string) {
    const member = await this.prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
    if (!member) throw new NotFoundException('That shared list does not exist, or you are not a member.');
    return member;
  }

  async memberIds(spaceId: string) {
    const rows = await this.prisma.spaceMember.findMany({ where: { spaceId }, select: { userId: true } });
    return rows.map((row) => row.userId);
  }

  async list(userId: string) {
    const spaces = await this.prisma.space.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'asc' },
      include: SPACE_INCLUDE,
    });
    return spaces.map((space) => this.toPublic(space, userId));
  }

  async create(userId: string, name: string) {
    const space = await this.prisma.space.create({
      data: { name, inviteCode: newInviteCode(), members: { create: { userId, role: SpaceRole.OWNER } } },
      include: SPACE_INCLUDE,
    });
    this.events.notify([userId], { type: 'spaces' });
    return this.toPublic(space, userId);
  }

  async rename(userId: string, spaceId: string, name: string) {
    await this.requireMember(userId, spaceId);
    const space = await this.prisma.space.update({ where: { id: spaceId }, data: { name }, include: SPACE_INCLUDE });
    await this.notifyMembers(spaceId);
    return this.toPublic(space, userId);
  }

  /** A new code makes the old invite link stop working. Owner only. */
  async resetInvite(userId: string, spaceId: string) {
    await this.requireOwner(userId, spaceId);
    const space = await this.prisma.space.update({
      where: { id: spaceId },
      data: { inviteCode: newInviteCode() },
      include: SPACE_INCLUDE,
    });
    await this.notifyMembers(spaceId);
    return this.toPublic(space, userId);
  }

  /** What the join page shows before the user accepts. */
  async preview(userId: string, code: string) {
    const space = await this.prisma.space.findUnique({ where: { inviteCode: code }, include: SPACE_INCLUDE });
    if (!space) throw new NotFoundException('This invite link does not work. Ask for a new one.');
    return {
      id: space.id,
      name: space.name,
      memberNames: space.members.map((m) => m.user.name),
      hackathonCount: space._count.hackathons,
      alreadyMember: space.members.some((m) => m.userId === userId),
    };
  }

  async join(userId: string, code: string) {
    const space = await this.prisma.space.findUnique({ where: { inviteCode: code } });
    if (!space) throw new NotFoundException('This invite link does not work. Ask for a new one.');
    await this.prisma.spaceMember.upsert({
      where: { spaceId_userId: { spaceId: space.id, userId } },
      create: { spaceId: space.id, userId },
      update: {},
    });
    await this.notifyMembers(space.id);
    return { id: space.id };
  }

  /**
   * Removes a member. Members can remove themselves (leave). The owner can remove anyone else.
   * When the last member leaves, the list and its hackathons are deleted.
   */
  async removeMember(userId: string, spaceId: string, targetId: string) {
    const me = await this.requireMember(userId, spaceId);
    if (targetId !== userId && me.role !== SpaceRole.OWNER) {
      throw new ForbiddenException('Only the owner of this list can remove people.');
    }
    const before = await this.memberIds(spaceId);
    const { count } = await this.prisma.spaceMember.deleteMany({ where: { spaceId, userId: targetId } });
    if (!count) throw new NotFoundException('That person is not in this list.');

    const rest = await this.prisma.spaceMember.findMany({ where: { spaceId }, orderBy: { joinedAt: 'asc' } });
    if (!rest.length) {
      await this.prisma.space.delete({ where: { id: spaceId } });
    } else if (!rest.some((m) => m.role === SpaceRole.OWNER)) {
      // The owner left, so the longest-standing member takes over.
      await this.prisma.spaceMember.update({
        where: { spaceId_userId: { spaceId, userId: rest[0].userId } },
        data: { role: SpaceRole.OWNER },
      });
    }
    this.events.notify(before, { type: 'spaces' });
  }

  /** Deletes the list and every hackathon in it. Owner only. */
  async remove(userId: string, spaceId: string) {
    await this.requireOwner(userId, spaceId);
    const before = await this.memberIds(spaceId);
    await this.prisma.space.delete({ where: { id: spaceId } });
    this.events.notify(before, { type: 'spaces' });
  }

  private async requireOwner(userId: string, spaceId: string) {
    const member = await this.requireMember(userId, spaceId);
    if (member.role !== SpaceRole.OWNER) throw new ForbiddenException('Only the owner of this list can do that.');
  }

  private async notifyMembers(spaceId: string) {
    this.events.notify(await this.memberIds(spaceId), { type: 'spaces' });
  }

  private toPublic(
    space: {
      id: string;
      name: string;
      inviteCode: string;
      createdAt: Date;
      members: { role: SpaceRole; userId: string; joinedAt: Date; user: { id: string; name: string; email: string } }[];
      _count: { hackathons: number };
    },
    userId: string,
  ) {
    return {
      id: space.id,
      name: space.name,
      inviteCode: space.inviteCode,
      createdAt: space.createdAt,
      hackathonCount: space._count.hackathons,
      role: space.members.find((m) => m.userId === userId)?.role ?? SpaceRole.MEMBER,
      members: space.members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt })),
    };
  }
}
