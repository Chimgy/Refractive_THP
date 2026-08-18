import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { GithubModule } from '../github-dora/github.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { UsersModule } from '../users/users.module';
import { Project } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

// LiveAuthGuard (applied to ProjectsController) needs UsersService and
// CompaniesService resolvable in this module's scope — same reason
// CompaniesModule itself imports UsersModule. TelemetryModule is imported
// for TelemetryUniquesService, read by the uniques-count route below.
@Module({
  imports: [
    TypeOrmModule.forFeature([Project]),
    UsersModule,
    CompaniesModule,
    TelemetryModule,
    GithubModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
