import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CompanyInvitesService } from '../companies/company-invites.service';
import { CompaniesService } from '../companies/companies.service';
import { RedisService } from '../redis/redis.service';
import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service';
import { User } from '../users/entities/user.entity';
import { SafeUser, toSafeUser } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { authCacheKey } from './auth-cache.util';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';

const SALT_ROUNDS = 10;

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
};
export type RefreshResult = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly companyInvitesService: CompanyInvitesService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Whoever creates a company is its first admin; everyone who joins later
    // via an invite gets whatever role that invite grants.
    const company = await this.companiesService.create(dto.companyName);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.usersService.create(
      dto.email,
      passwordHash,
      'admin',
      company.id,
      dto.displayName,
    );

    return this.issueAuthResult(user);
  }

  async acceptInvite(token: string, dto: AcceptInviteDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const invite = await this.companyInvitesService.consume(token);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.usersService.create(
      dto.email,
      passwordHash,
      invite.role,
      invite.companyId,
    );

    return this.issueAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account disabled');
    }

    const company = await this.companiesService.findById(user.companyId);
    if (!company || !company.isActive) {
      throw new ForbiddenException('Company deactivated');
    }

    return this.issueAuthResult(user);
  }

  async refresh(rawRefreshToken: string): Promise<RefreshResult> {
    const { userId, token } =
      await this.refreshTokensService.rotate(rawRefreshToken);

    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return { accessToken: this.signAccessToken(user), refreshToken: token };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokensService.revoke(rawRefreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokensService.revokeAllForUser(userId);
    await this.redisService.del(authCacheKey(userId));
  }

  private async issueAuthResult(user: User): Promise<AuthResult> {
    const accessToken = this.signAccessToken(user);
    const { token: refreshToken } = await this.refreshTokensService.issue(
      user.id,
    );
    return { accessToken, refreshToken, user: toSafeUser(user) };
  }

  private signAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      displayName: user.displayName,
    };
    return this.jwtService.sign(payload);
  }
}
