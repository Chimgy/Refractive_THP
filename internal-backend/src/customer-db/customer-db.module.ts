import { Global, Module } from '@nestjs/common';
import { CustomerDbReadService } from './customer-db-read.service';

// Global (same pattern as backend's RedisModule) — one pool, shared by every
// pull job, without each ingestion/metrics module needing to re-import this.
@Global()
@Module({
  providers: [CustomerDbReadService],
  exports: [CustomerDbReadService],
})
export class CustomerDbModule {}
