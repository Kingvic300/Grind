import { Body, Controller, Get, HttpCode, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { LoginDto, SignupDto, UpdateProfileDto } from './auth.dto';
import { AUTH_COOKIE, AuthGuard, UserId } from './auth.guard';
import { AuthService } from './auth.service';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// The web app and the API are on different sites in production, so the browser only sends
// the cookie with SameSite=None, which requires Secure. Local dev is same-site over HTTP.
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  secure: IS_PRODUCTION,
  path: '/',
} as const;

function setSessionCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, { ...COOKIE_BASE, maxAge: THIRTY_DAYS_MS });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.signup(dto);
    setSessionCookie(res, token);
    return user;
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto);
    setSessionCookie(res, token);
    return user;
  }

  @HttpCode(204)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, COOKIE_BASE);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@UserId() userId: string) {
    return this.auth.me(userId);
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  update(@UserId() userId: string, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(userId, dto);
  }
}
