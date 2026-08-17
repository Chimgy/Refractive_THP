import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { UsersModule } from '../users/users.module';
import { RumEvent } from './entities/rum-event.entity';
import { UsageEvent } from './entities/usage-event.entity';
import { UsageEventsController } from './usage-events.controller';
import { UsageEventsService } from './usage-events.service';

// UsersModule/CompaniesModule imported for LiveAuthGuard's own dependencies
// (UsersService/CompaniesService) — same reason ProjectsModule imports them.
// RumEvent registered now even though its controller lands in a later phase
// (plan §"Build order", Phase 3) — cheap to do once here rather than editing
// this module again later.
@Module({
  imports: [
    TypeOrmModule.forFeature([UsageEvent, RumEvent]),
    UsersModule,
    CompaniesModule,
  ],
  controllers: [UsageEventsController],
  providers: [UsageEventsService],
  exports: [UsageEventsService],
})
export class UsageAnalyticsModule {}
