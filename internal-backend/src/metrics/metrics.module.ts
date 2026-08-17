import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyActiveUserLog } from '../ingestion/entities/daily-active-user-log.entity';
import { UsageMetricsDaily } from '../ingestion/entities/usage-metrics-daily.entity';
import { MetricsController } from './metrics.controller';
import { MetricsQueryService } from './metrics-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([DailyActiveUserLog, UsageMetricsDaily])],
  controllers: [MetricsController],
  providers: [MetricsQueryService],
})
export class MetricsModule {}
