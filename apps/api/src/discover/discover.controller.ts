import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { DiscoverService } from './discover.service';

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
}
