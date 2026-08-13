import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelemetryEvent } from './entities/telemetry-event.entity';

@Injectable()
export class TelemetryEventsService {
  constructor(
    @InjectRepository(TelemetryEvent)
    private readonly events: Repository<TelemetryEvent>,
  ) {}

  async recordBatch(
    payload: Record<string, unknown>,
    meta: { projectId: string | null },
  ) {
    const sessionId =
      typeof payload.sessionId === 'string' ? payload.sessionId : null;
    const rawEvents = Array.isArray(payload.events) ? payload.events : [];
    if (!sessionId || rawEvents.length === 0) return;

    const rows = rawEvents
      .filter(
        (event): event is Record<string, unknown> =>
          typeof event === 'object' && event !== null,
      )
      .map(({ type, url, ts, ...data }) =>
        this.events.create({
          projectId: meta.projectId,
          sessionId,
          eventType: typeof type === 'string' ? type : 'unknown',
          url: typeof url === 'string' ? url : null,
          occurredAt: typeof ts === 'number' ? new Date(ts) : new Date(),
          data,
        }),
      );

    await this.events.save(rows);
  }
}
