import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IngestionState } from './entities/ingestion-state.entity';

@Injectable()
export class IngestionWatermarkService {
  constructor(
    @InjectRepository(IngestionState)
    private readonly ingestionStateRepository: Repository<IngestionState>,
  ) {}

  async getLastPulledAt(jobName: string, fallback: Date): Promise<Date> {
    const row = await this.ingestionStateRepository.findOne({
      where: { jobName },
    });
    return row?.lastPulledAt ?? fallback;
  }

  async advance(jobName: string, cutoff: Date): Promise<void> {
    await this.ingestionStateRepository.upsert(
      { jobName, lastPulledAt: cutoff },
      ['jobName'],
    );
  }
}
