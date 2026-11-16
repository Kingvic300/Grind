import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Observable, interval, map, merge } from 'rxjs';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { EventsService } from './events.service';

const HEARTBEAT_MS = 25_000;

@UseGuards(AuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** Server-Sent Events stream of changes that concern the logged-in user. */
  @SkipThrottle()
  @Sse()
  stream(@UserId() userId: string): Observable<MessageEvent> {
    // The heartbeat keeps proxies from closing an idle connection.
    const heartbeat = interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: '' })));
    const changes = this.events.streamFor(userId).pipe(map((event): MessageEvent => ({ type: 'change', data: event })));
    return merge(changes, heartbeat);
  }
}
