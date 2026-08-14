import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomSlugSuffix, slugify } from '../companies/slug.util';
import { Project } from './entities/project.entity';

const MAX_SLUG_ATTEMPTS = 5;

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  async create(
    companyId: string,
    name: string,
    allowedOrigins: string[] = [],
  ): Promise<Project> {
    const base = slugify(name);
    let slug = base;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const taken = await this.projectsRepository.exists({
        where: { companyId, slug },
      });
      if (!taken) break;
      slug = `${base}-${randomSlugSuffix()}`;
    }

    const project = this.projectsRepository.create({
      companyId,
      name,
      slug,
      allowedOrigins,
    });
    return this.projectsRepository.save(project);
  }

  findByCompany(companyId: string): Promise<Project[]> {
    return this.projectsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdForCompany(id: string, companyId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project || project.companyId !== companyId) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
