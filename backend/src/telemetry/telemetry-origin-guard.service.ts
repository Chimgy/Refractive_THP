import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';

// `Project.id` is a Postgres `uuid` column — a malformed projectId (which is
// exactly what an unregistered/made-up one usually is, e.g. the "abc123"
// placeholder from project-plan.md's own example snippet) makes the query
// itself throw `invalid input syntax for type uuid` rather than just
// returning no rows. Checked before ever touching the DB, both to avoid
// that crash and to skip the round trip entirely for obviously-invalid ids.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fails closed, deliberately (external_data.md roadmap item 6): an
// unregistered projectId, or a registered project with no matching origin
// in its allowlist (including one with nothing configured yet), is
// rejected. Reads Project directly via its own repository rather than
// ProjectsService, to avoid a circular module dependency — ProjectsModule
// already imports TelemetryModule for TelemetryUniquesService.
@Injectable()
export class TelemetryOriginGuardService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  async isAllowed(projectId: string, origin: string | null): Promise<boolean> {
    if (!origin || !UUID_PATTERN.test(projectId)) return false;

    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) return false;

    return project.allowedOrigins.includes(origin);
  }
}
