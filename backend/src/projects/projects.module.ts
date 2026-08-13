import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { UsersModule } from '../users/users.module';
import { Project } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

// LiveAuthGuard (applied to ProjectsController) needs UsersService and
// CompaniesService resolvable in this module's scope — same reason
// CompaniesModule itself imports UsersModule.
@Module({
  imports: [TypeOrmModule.forFeature([Project]), UsersModule, CompaniesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
