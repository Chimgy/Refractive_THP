import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawTelemetrySnapshot } from './entities/raw-telemetry-snapshot.entity';

@Injectable()
export class TelemetrySnapshotsService {
  constructor(
    @InjectRepository(RawTelemetrySnapshot)
    private readonly snapshots: Repository<RawTelemetrySnapshot>,
  ) {}

  async capture(
    payload: Record<string, unknown>,
    meta: { projectId: string | null; userAgent: string | null },
  ) {
    const snapshot = this.snapshots.create({
      projectId: meta.projectId,
      payload,
      userAgent: meta.userAgent,
    });
    await this.snapshots.save(snapshot);
  }
}
