import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelemetryErrorFingerprint } from './entities/telemetry-error-fingerprint.entity';
import { fingerprint } from './telemetry-fingerprint.util';

type TalliedError = {
  message: string;
  file: string | null;
  line: number | null;
  col: number | null;
  occurrences: number;
};

@Injectable()
export class TelemetryErrorsService {
  constructor(
    @InjectRepository(TelemetryErrorFingerprint)
    private readonly errors: Repository<TelemetryErrorFingerprint>,
  ) {}

  // One upsert per distinct fingerprint in the batch, not per event — a page
  // that throws the same error 5 times in one flush should bump count by 5,
  // not insert 5 rows, so same-fingerprint occurrences within the batch are
  // tallied locally first (same pattern as TelemetryCountersService).
  async recordBatch(
    payload: Record<string, unknown>,
    meta: { projectId: string | null },
  ): Promise<void> {
    const rawEvents = Array.isArray(payload.events) ? payload.events : [];
    if (rawEvents.length === 0) return;

    const tallies = new Map<string, TalliedError>();
    for (const event of rawEvents) {
      if (typeof event !== 'object' || event === null) continue;
      const e = event as Record<string, unknown>;
      if (e.type !== 'error') continue;

      const message =
        typeof e.message === 'string' ? e.message : 'Unknown error';
      const file = typeof e.file === 'string' ? e.file : null;
      const line = typeof e.line === 'number' ? e.line : null;
      const col = typeof e.col === 'number' ? e.col : null;
      const fp = fingerprint(message, file, line, col);

      const existing = tallies.get(fp);
      if (existing) {
        existing.occurrences += 1;
      } else {
        tallies.set(fp, { message, file, line, col, occurrences: 1 });
      }
    }
    if (tallies.size === 0) return;

    await Promise.all(
      Array.from(tallies.entries()).map(([fp, e]) =>
        this.upsert(meta.projectId, fp, e),
      ),
    );
  }

  async list(
    projectId: string,
    { page, limit }: { page: number; limit: number },
  ): Promise<TelemetryErrorFingerprint[]> {
    return this.errors.find({
      where: { projectId },
      order: { lastSeenAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  private async upsert(
    projectId: string | null,
    fp: string,
    e: TalliedError,
  ): Promise<void> {
    await this.errors.query(
      `INSERT INTO telemetry_error_fingerprints
         ("projectId", fingerprint, message, file, line, col, count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("projectId", fingerprint)
       DO UPDATE SET
         count = telemetry_error_fingerprints.count + $7,
         "lastSeenAt" = now()`,
      [projectId, fp, e.message, e.file, e.line, e.col, e.occurrences],
    );
  }
}
