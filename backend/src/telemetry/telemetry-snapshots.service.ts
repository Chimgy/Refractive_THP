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
    meta: { ip: string | null; userAgent: string | null },
  ) {
    const projectId =
      typeof payload.projectId === 'string' ? payload.projectId || null : null;

    const snapshot = this.snapshots.create({
      projectId,
      payload,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await this.snapshots.save(snapshot);
  }
}
