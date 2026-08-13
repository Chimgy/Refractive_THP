import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { UserRole } from '../users/entities/user.entity';
import { CompanyInvite } from './entities/company-invite.entity';

const INVITE_TTL_DAYS = 7;

export type ConsumedInvite = { companyId: string; role: UserRole };

@Injectable()
export class CompanyInvitesService {
  constructor(
    @InjectRepository(CompanyInvite)
    private readonly invitesRepository: Repository<CompanyInvite>,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async create(
    companyId: string,
    role: UserRole,
    createdByUserId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invite = this.invitesRepository.create({
      companyId,
      role,
      createdByUserId,
      tokenHash: this.hash(token),
      expiresAt,
      usedAt: null,
    });
    await this.invitesRepository.save(invite);

    return { token, expiresAt };
  }

  async consume(rawToken: string): Promise<ConsumedInvite> {
    const invite = await this.invitesRepository.findOne({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!invite) {
      throw new NotFoundException('Invalid invite');
    }
    if (invite.usedAt) {
      throw new ConflictException('Invite already used');
    }
    if (invite.revokedAt) {
      throw new GoneException('Invite revoked');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Invite expired');
    }

    invite.usedAt = new Date();
    await this.invitesRepository.save(invite);

    return { companyId: invite.companyId, role: invite.role };
  }

  findByCompany(companyId: string): Promise<CompanyInvite[]> {
    return this.invitesRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(companyId: string, inviteId: string): Promise<void> {
    const invite = await this.invitesRepository.findOne({
      where: { id: inviteId },
    });
    if (!invite || invite.companyId !== companyId) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.usedAt) {
      throw new ConflictException('Invite already used');
    }
    if (invite.revokedAt) {
      throw new ConflictException('Invite already revoked');
    }

    invite.revokedAt = new Date();
    await this.invitesRepository.save(invite);
  }
}
