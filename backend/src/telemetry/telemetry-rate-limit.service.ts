import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const WINDOW_SECONDS = 60;
// A single visitor's tab flushes roughly every 5-15s (interval + hide/pagehide
// triggers). 120/min per (project, ip) covers a generous number of concurrent
// tabs/visitors behind one IP (NAT'd office, campus wifi) while still capping
// a runaway loop. A first guess, same as every other threshold in this
// pipeline — needs revisiting once there's real traffic to size it against.
const MAX_REQUESTS_PER_WINDOW = 120;

@Injectable()
export class TelemetryRateLimitService {
  constructor(private readonly redis: RedisService) {}

  async allow(projectId: string, ip: string): Promise<boolean> {
    const key = `telemetry:ratelimit:${projectId}:${ip}`;
    const count = await this.redis.incrWithExpireNx(key, WINDOW_SECONDS);
    return count <= MAX_REQUESTS_PER_WINDOW;
  }
}
