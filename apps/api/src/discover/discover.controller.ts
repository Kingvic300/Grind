import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { DiscoverService } from './discover.service';

class ScanLinkDto {
  @IsString()
  @Length(4, 500, { message: 'Paste the full link of the hackathon page.' })
  url: string;
}

// Behind login, so the API is not an open proxy for these sites.
@UseGuards(AuthGuard)
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  list() {
    return this.discover.list();
  }

  /** Reads a hackathon from a pasted link. Returns a draft for the form; nothing is saved. */
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @HttpCode(200)
  @Post('scan')
  scan(@Body() dto: ScanLinkDto) {
    return this.discover.scan(dto.url);
  }
}
