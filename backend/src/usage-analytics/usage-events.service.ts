import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUsageEventDto } from './dto/create-usage-events.dto';
import { UsageEvent } from './entities/usage-event.entity';

@Injectable()
export class UsageEventsService {
  constructor(
    @InjectRepository(UsageEvent)
    private readonly usageEventsRepository: Repository<UsageEvent>,
  ) {}

  // companyId/userId/country are always derived server-side (JWT + trusted
  // header), never taken from the request body — same rule tenant routes
  // already follow for companyId (see ProjectsController).
  async recordBatch(
    companyId: string,
    userId: string,
    country: string | null,
    events: CreateUsageEventDto[],
  ): Promise<void> {
    const rows = events.map((event) =>
      this.usageEventsRepository.create({
        companyId,
        userId,
        eventType: event.eventType,
        eventName: event.eventName,
        route: event.route ?? null,
        metadata: event.metadata ?? {},
        country,
      }),
    );
    // .save(), not .insert() — matches TelemetrySnapshotsService.capture()'s
    // precedent for a jsonb Record<string, unknown> column, which .insert()'s
    // stricter QueryDeepPartialEntity typing rejects.
    await this.usageEventsRepository.save(rows);
  }
}
