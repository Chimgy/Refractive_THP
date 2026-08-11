import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

export type IssuedToken = { token: string; expiresAt: Date };
export type RotatedToken = { userId: string; token: string; expiresAt: Date };

@Injectable()
export class RefreshTokensService {
  private readonly ttlMs: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokensRepository: Repository<RefreshToken>,
    configService: ConfigService,
  ) {
    const ttlDays = Number(configService.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'));
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async issue(userId: string): Promise<IssuedToken> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.ttlMs);

    const row = this.tokensRepository.create({ userId, tokenHash: this.hash(token), expiresAt, isRevoked: false });
    await this.tokensRepository.save(row);

    return { token, expiresAt };
  }

  // Rotation: every refresh both revokes the presented token and issues a
  // fresh one. If a token that's already revoked gets presented again, that
  // can only happen if it was stolen and used concurrently with the
  // legitimate client — so every other live session for this user gets
  // revoked too, forcing a re-login.
  async rotate(rawToken: string): Promise<RotatedToken> {
    const row = await this.tokensRepository.findOne({ where: { tokenHash: this.hash(rawToken) } });
    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (row.isRevoked) {
      await this.revokeAllForUser(row.userId);
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    row.isRevoked = true;
    row.revokedAt = new Date();
    await this.tokensRepository.save(row);

    const { token, expiresAt } = await this.issue(row.userId);
    return { userId: row.userId, token, expiresAt };
  }

  async revoke(rawToken: string): Promise<void> {
    await this.tokensRepository.update({ tokenHash: this.hash(rawToken) }, { isRevoked: true, revokedAt: new Date() });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokensRepository.update({ userId, isRevoked: false }, { isRevoked: true, revokedAt: new Date() });
  }
}
