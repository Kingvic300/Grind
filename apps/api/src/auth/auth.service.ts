import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SpaceRole, type User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto, SignupDto, UpdateProfileDto } from './auth.dto';

/** Everything about the user the web app may see. Never the password hash or token version. */
const PUBLIC_FIELDS = [
  'id', 'email', 'name', 'createdAt',
  'avatarUrl', 'avatarColor', 'bio', 'githubUrl', 'linkedinUrl', 'websiteUrl', 'xUrl', 'skills',
  'emailReminders', 'remindSubmission3d', 'remindSubmission1d', 'remindRegistration1d', 'weeklyDigest',
  'interestKind', 'interestTopics', 'interestStack', 'interestFormat',
  'defaultSpaceId', 'weekStart', 'timeFormat',
] as const;

export type PublicUser = Pick<User, (typeof PUBLIC_FIELDS)[number]> & { calendarFeed: boolean };

function toPublic(user: User): PublicUser {
  const out = Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, user[k]])) as Pick<User, (typeof PUBLIC_FIELDS)[number]>;
  return { ...out, calendarFeed: Boolean(user.calendarToken) };
}

// Compared against when the email is unknown, so both failure paths take similar time.
const DUMMY_HASH = bcrypt.hashSync('grind-dummy-password', 12);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An account with this email already exists. Log in instead.');
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash: await bcrypt.hash(dto.password, 12) },
    });
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('That email and password do not match.');
    return this.session(user);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Log in to continue.');
    return toPublic(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const data: UpdateProfileDto = { ...dto };
    if (data.skills) data.skills = [...new Set(data.skills.map((s) => s.trim()).filter(Boolean))];
    // "private" means open the private list. Anything else must be a list the user is in.
    if (data.defaultSpaceId && data.defaultSpaceId !== 'private') {
      const member = await this.prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: data.defaultSpaceId, userId } } });
      if (!member) throw new BadRequestException('You are not a member of that list.');
    }
    return toPublic(await this.prisma.user.update({ where: { id: userId }, data }));
  }

  /** Changes the password and signs out every other device. Returns a fresh session for this one. */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.requirePassword(userId, dto.currentPassword, 'Your current password is not right.');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 12), tokenVersion: { increment: 1 } },
    });
    return this.session(updated);
  }

  /** Ends every session except the one making the request. */
  async signOutOthers(userId: string) {
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    return this.session(updated);
  }

  /** Counts across the private list and every shared list the user is in. */
  async stats(userId: string) {
    const where = { OR: [{ userId, spaceId: null }, { space: { members: { some: { userId } } } }] };
    const [tracked, submitted, wins, prize, lists] = await Promise.all([
      this.prisma.hackathon.count({ where }),
      this.prisma.hackathon.count({ where: { ...where, status: { in: ['SUBMITTED', 'DONE'] } } }),
      this.prisma.hackathon.count({ where: { ...where, won: true } }),
      this.prisma.hackathon.aggregate({ where, _sum: { prizeAmount: true } }),
      this.prisma.spaceMember.count({ where: { userId } }),
    ]);
    return { tracked, submitted, wins, prizeMoney: prize._sum.prizeAmount ?? 0, sharedLists: lists };
  }

  /** Everything Grind stores about the user, for the "download my data" button. */
  async export(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [hackathons, memberships] = await Promise.all([
      this.prisma.hackathon.findMany({
        where: { OR: [{ userId, spaceId: null }, { space: { members: { some: { userId } } } }] },
        include: { space: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.spaceMember.findMany({ where: { userId }, include: { space: { select: { id: true, name: true, createdAt: true } } } }),
    ]);
    const { avatarUrl: _photo, ...profile } = toPublic(user);
    return {
      exportedAt: new Date().toISOString(),
      profile: { ...profile, hasPhoto: Boolean(user.avatarUrl) },
      sharedLists: memberships.map((m) => ({ ...m.space, role: m.role, joinedAt: m.joinedAt })),
      hackathons: hackathons.map(({ space, userId: _u, updatedById: _e, ...h }) => ({ ...h, list: space?.name ?? 'My hackathons' })),
    };
  }

  /**
   * Deletes the account. Hackathons the user added to shared lists stay with the list and pass
   * to another member, so friends do not lose them. Lists where the user is alone are deleted.
   */
  async deleteAccount(userId: string, password: string) {
    await this.requirePassword(userId, password, 'That password is not right.');
    const memberships = await this.prisma.spaceMember.findMany({ where: { userId } });
    await this.prisma.$transaction(async (tx) => {
      for (const m of memberships) {
        const heir = await tx.spaceMember.findFirst({
          where: { spaceId: m.spaceId, userId: { not: userId } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        });
        if (!heir) {
          await tx.space.delete({ where: { id: m.spaceId } });
          continue;
        }
        await tx.hackathon.updateMany({ where: { spaceId: m.spaceId, userId }, data: { userId: heir.userId } });
        if (m.role === SpaceRole.OWNER && heir.role !== SpaceRole.OWNER) {
          const otherOwner = await tx.spaceMember.count({ where: { spaceId: m.spaceId, role: SpaceRole.OWNER, userId: { not: userId } } });
          if (!otherOwner) {
            await tx.spaceMember.update({ where: { spaceId_userId: { spaceId: m.spaceId, userId: heir.userId } }, data: { role: SpaceRole.OWNER } });
          }
        }
      }
      await tx.user.delete({ where: { id: userId } });
    });
  }

  /** Turns the calendar feed on with a new secret link. Any older link stops working. */
  async rotateCalendarToken(userId: string) {
    const token = randomBytes(24).toString('base64url');
    await this.prisma.user.update({ where: { id: userId }, data: { calendarToken: token } });
    return { token };
  }

  async calendarToken(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { calendarToken: true } });
    return { token: user.calendarToken };
  }

  async disableCalendar(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { calendarToken: null } });
  }

  private async requirePassword(userId: string, password: string, message: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new BadRequestException(message);
    return user;
  }

  private async session(user: User) {
    return { user: toPublic(user), token: await this.jwt.signAsync({ sub: user.id, tv: user.tokenVersion }) };
  }
}
