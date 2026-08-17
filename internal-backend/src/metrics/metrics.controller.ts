import { Controller, Get } from '@nestjs/common';
import { MetricsQueryService } from './metrics-query.service';

// No explicit guard needed — CloudflareAccessGuard is global (AuthModule,
// APP_GUARD). This is internal-frontend's only data source; it never reads
// customerDB directly, only internalDB's own rollup tables.
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsQueryService: MetricsQueryService) {}

  @Get('usage')
  getUsage() {
    return this.metricsQueryService.getUsageSummary();
  }
}
