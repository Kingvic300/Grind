import { Logger } from '@nestjs/common';

const logger = new Logger('Background');

/**
 * Runs follow-up work after a write, such as activity entries and live update pings, without
 * holding the response. The database is remote, so each awaited round trip adds latency to every
 * save. A failure is logged, not thrown: the write itself already succeeded.
 */
export function background(label: string, job: () => Promise<unknown>) {
  void job().catch((error) => logger.warn(`${label} failed: ${(error as Error).message}`));
}
