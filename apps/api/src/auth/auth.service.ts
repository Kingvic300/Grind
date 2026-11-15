import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, SignupDto, UpdateProfileDto } from './auth.dto';

export type PublicUser = Pick<User, 'id' | 'email' | 'name' | 'emailReminders' | 'createdAt'>;

const toPublic = ({ id, email, name, emailReminders, createdAt }: User): PublicUser => ({
  id,
  email,
  name,
  emailReminders,
  createdAt,
});

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
    return toPublic(await this.prisma.user.update({ where: { id: userId }, data: dto }));
  }

  private async session(user: User) {
    return { user: toPublic(user), token: await this.jwt.signAsync({ sub: user.id }) };
  }
}
