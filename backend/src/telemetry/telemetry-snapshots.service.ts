import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawTelemetrySnapshot } from './entities/raw-telemetry-snapshot.entity';
import { fingerprint } from './telemetry-fingerprint.util';

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
      errorFingerprints: this.extractFingerprints(payload),
    });
    await this.snapshots.save(snapshot);
  }

  async findByFingerprint(
    projectId: string,
    fp: string,
    { page, limit }: { page: number; limit: number },
  ): Promise<
    { id: string; receivedAt: Date; device: unknown; events: unknown }[]
  > {
    return this.snapshots.query(
      `SELECT id, "receivedAt", payload->'device' AS device, payload->'events' AS events
       FROM raw_telemetry_snapshots
       WHERE "projectId" = $1 AND "errorFingerprints" @> ARRAY[$2]
       ORDER BY "receivedAt" DESC
       LIMIT $3 OFFSET $4`,
      [projectId, fp, limit, (page - 1) * limit],
    );
  }

  // Mirrors the event walk in TelemetryErrorsService.recordBatch — must
  // produce the exact same hashes so a fingerprint row can be traced back
  // to the raw snapshots it came from.
  private extractFingerprints(
    payload: Record<string, unknown>,
  ): string[] | null {
    const rawEvents = Array.isArray(payload.events) ? payload.events : [];
    if (rawEvents.length === 0) return null;

    const fingerprints = new Set<string>();
    for (const event of rawEvents) {
      if (typeof event !== 'object' || event === null) continue;
      const e = event as Record<string, unknown>;
      if (e.type !== 'error') continue;

      const message =
        typeof e.message === 'string' ? e.message : 'Unknown error';
      const file = typeof e.file === 'string' ? e.file : null;
      const line = typeof e.line === 'number' ? e.line : null;
      const col = typeof e.col === 'number' ? e.col : null;
      fingerprints.add(fingerprint(message, file, line, col));
    }
    return fingerprints.size > 0 ? Array.from(fingerprints) : null;
  }
}
