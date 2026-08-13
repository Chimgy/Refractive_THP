import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { uniqueVisitorsCounterKey } from './telemetry-counter-keys.util';
import { hashVisitor } from './visitor-hash.util';

// Matches TelemetryCountersService's TTL — same "no rollup job yet, but
// don't accumulate forever either" reasoning.
const UNIQUES_TTL_SECONDS = 8 * 24 * 60 * 60;
const INSECURE_DEFAULT_SECRET = 'dev-secret-change-me';

@Injectable()
export class TelemetryUniquesService {
  private readonly logger = new Logger(TelemetryUniquesService.name);
  private readonly hashSecret: string;

  constructor(
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    this.hashSecret = configService.get<string>(
      'TELEMETRY_HASH_SECRET',
      INSECURE_DEFAULT_SECRET,
    );
    if (this.hashSecret === INSECURE_DEFAULT_SECRET) {
      this.logger.warn(
        'TELEMETRY_HASH_SECRET is not set — using the insecure hardcoded default. Set it in .env.',
      );
    }
  }

  // One PFADD per POST, not per event — ip/UA are request-level, not
  // per-event, so there's nothing to gain from repeating this across a
  // batch the way pageview/click counters repeat per event.
  async recordVisit(meta: {
    projectId: string | null;
    ip: string;
    userAgent: string | null;
  }): Promise<void> {
    const project = meta.projectId ?? 'unknown';
    const today = new Date().toISOString().slice(0, 10);
    const visitorId = hashVisitor(
      this.hashSecret,
      meta.ip,
      meta.userAgent ?? '',
      today,
    );

    await this.redis.pfaddWithExpire(
      uniqueVisitorsCounterKey(project, today),
      visitorId,
      UNIQUES_TTL_SECONDS,
    );
  }
}
