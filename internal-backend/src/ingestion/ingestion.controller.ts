import { Controller, HttpCode, Post } from '@nestjs/common';
import { UsageEventsPullJob } from './usage-events-pull.job';

// Manual-trigger surface for dev/verification — no explicit guard needed,
// CloudflareAccessGuard is global (AuthModule, APP_GUARD). Lets Phase 1's
// dedup check (plan §"Build order") be verified on demand instead of
// waiting up to an hour for the real cron tick.
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly usageEventsPullJob: UsageEventsPullJob) {}

  @Post('usage-events/run')
  @HttpCode(202)
  async runUsageEventsPull(): Promise<{ triggered: true }> {
    await this.usageEventsPullJob.run();
    return { triggered: true };
  }
}
