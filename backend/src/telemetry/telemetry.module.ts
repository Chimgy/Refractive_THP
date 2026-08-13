import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryErrorFingerprint } from './entities/telemetry-error-fingerprint.entity';
import { TelemetryEvent } from './entities/telemetry-event.entity';
import { TelemetrySnapshot } from './entities/telemetry-snapshot.entity';
import { TelemetryController } from './telemetry.controller';
import { TelemetryCountersService } from './telemetry-counters.service';
import { TelemetryErrorsService } from './telemetry-errors.service';
import { TelemetryEventsService } from './telemetry-events.service';
import { TelemetrySnapshotsService } from './telemetry-snapshots.service';
import { TelemetryUniquesService } from './telemetry-uniques.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TelemetrySnapshot,
      TelemetryEvent,
      TelemetryErrorFingerprint,
    ]),
  ],
  controllers: [TelemetryController],
  providers: [
    TelemetrySnapshotsService,
    TelemetryEventsService,
    TelemetryCountersService,
    TelemetryUniquesService,
    TelemetryErrorsService,
  ],
})
export class TelemetryModule {}
