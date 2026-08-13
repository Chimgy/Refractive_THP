import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelemetrySnapshot } from './entities/telemetry-snapshot.entity';

@Injectable()
export class TelemetrySnapshotsService {
  constructor(
    @InjectRepository(TelemetrySnapshot)
    private readonly snapshots: Repository<TelemetrySnapshot>,
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
