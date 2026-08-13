import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';

// Aggregates every tenant-facing module for DI purposes. The `/api/tenant`
// prefix itself is applied per-module in AppModule's RouterModule.register()
// call (RouterModule doesn't walk `imports`, so each module with controllers
// must be listed there too — see the comment in app.module.ts). Future
// tenant-facing modules (e.g. projects) get added to both places, not
// imported directly into AppModule.
@Module({
  imports: [CompaniesModule],
})
export class TenantModule {}
