import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetrySnapshot } from './entities/telemetry-snapshot.entity';
import { TelemetryController } from './telemetry.controller';
import { TelemetrySnapshotsService } from './telemetry-snapshots.service';

@Module({
  imports: [TypeOrmModule.forFeature([TelemetrySnapshot])],
  controllers: [TelemetryController],
  providers: [TelemetrySnapshotsService],
})
export class TelemetryModule {}
