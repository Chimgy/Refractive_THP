import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyActiveUserLog } from './entities/daily-active-user-log.entity';
import { IngestionState } from './entities/ingestion-state.entity';
import { UsageMetricsDaily } from './entities/usage-metrics-daily.entity';
import { VitalsMetric } from './entities/vitals-metric.entity';
import { IngestionController } from './ingestion.controller';
import { IngestionWatermarkService } from './ingestion-watermark.service';
import { UsageEventsPullJob } from './usage-events-pull.job';

// UsageMetricsDaily/VitalsMetric registered now even though the rollup jobs
// that write them land in later phases (plan §"Build order" Phases 2 & 3) —
// cheap to do once here rather than editing this module again later.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      IngestionState,
      DailyActiveUserLog,
      UsageMetricsDaily,
      VitalsMetric,
    ]),
  ],
  controllers: [IngestionController],
  providers: [IngestionWatermarkService, UsageEventsPullJob],
  exports: [IngestionWatermarkService],
})
export class IngestionModule {}
