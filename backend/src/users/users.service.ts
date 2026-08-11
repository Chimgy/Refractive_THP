import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByCompany(companyId: string): Promise<User[]> {
    return this.usersRepository.find({ where: { companyId, deletedAt: IsNull() }, order: { createdAt: 'ASC' } });
  }

  create(
    email: string,
    passwordHash: string,
    role: UserRole,
    companyId: string,
    displayName: string | null = null,
  ): Promise<User> {
    const user = this.usersRepository.create({ email, passwordHash, role, companyId, displayName });
    return this.usersRepository.save(user);
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.usersRepository.update({ id }, { isActive });
  }
}
