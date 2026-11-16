import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';

/** What changed. The web app refetches the matching data when it receives one. */
export type LiveEvent =
  | { type: 'hackathons'; spaceId: string | null }
  | { type: 'spaces' };

type Envelope = { userIds: string[]; event: LiveEvent };

/**
 * Pushes change notices to logged-in browsers. Kept in memory, so it works for one API
 * instance. Several instances would need a shared bus such as Postgres LISTEN/NOTIFY.
 */
@Injectable()
export class EventsService {
  private readonly bus = new Subject<Envelope>();

  notify(userIds: string[], event: LiveEvent) {
    if (userIds.length) this.bus.next({ userIds, event });
  }

  streamFor(userId: string): Observable<LiveEvent> {
    return this.bus.pipe(
      filter((envelope) => envelope.userIds.includes(userId)),
      map((envelope) => envelope.event),
    );
  }
}
