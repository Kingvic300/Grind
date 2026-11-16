import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const AUTH_COOKIE = 'grind_token';

/** What a session cookie holds. tv is missing on sessions made before it existed, which counts as 0. */
export type SessionPayload = { sub: string; tv?: number };

type AuthedRequest = Request & { userId?: string };

/**
 * Requires a valid session cookie and puts the user id on the request. The token version
 * is checked against the database, so a password change signs out every other device.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[AUTH_COOKIE];
    if (typeof token !== 'string' || !token) throw new UnauthorizedException('Log in to continue.');
    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException('Your session expired. Log in again.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true } });
    if (!user || user.tokenVersion !== (payload.tv ?? 0)) {
      throw new UnauthorizedException('You were signed out. Log in again.');
    }
    req.userId = payload.sub;
    return true;
  }
}

/** The id of the logged-in user. Only valid on routes behind AuthGuard. */
export const UserId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  return context.switchToHttp().getRequest<AuthedRequest>().userId as string;
});
