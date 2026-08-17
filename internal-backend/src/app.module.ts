import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CustomerDbModule } from './customer-db/customer-db.module';
import { dataSourceOptions } from './database/data-source';
import { IngestionModule } from './ingestion/ingestion.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
      // Schema changes ship via migrations (src/database/migrations) only —
      // matches the customer-facing backend's convention so dev never drifts
      // from what a real migration would produce.
      synchronize: false,
    }),
    // Drives UsageEventsPullJob's/RumVitalsPullJob's @Cron(EVERY_HOUR) —
    // this app has no BullMQ/Redis (see docker-compose.yml, internal-net has
    // no cache service), so scheduling is in-process cron, not a job queue.
    ScheduleModule.forRoot(),
    CustomerDbModule,
    AuthModule,
    IngestionModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
