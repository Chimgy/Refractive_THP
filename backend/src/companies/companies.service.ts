import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { randomSlugSuffix, slugify } from './slug.util';

const MAX_SLUG_ATTEMPTS = 5;

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
  ) {}

  async create(name: string): Promise<Company> {
    const base = slugify(name);
    let slug = base;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const taken = await this.companiesRepository.exists({ where: { slug } });
      if (!taken) break;
      slug = `${base}-${randomSlugSuffix()}`;
    }

    const company = this.companiesRepository.create({ name, slug });
    return this.companiesRepository.save(company);
  }

  findById(id: string): Promise<Company | null> {
    return this.companiesRepository.findOne({ where: { id } });
  }

  async deactivate(id: string): Promise<void> {
    await this.companiesRepository.update({ id }, { isActive: false, deletedAt: new Date() });
  }
}
