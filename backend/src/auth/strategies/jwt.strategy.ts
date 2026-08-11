import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CompaniesService } from '../../companies/companies.service';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/users.service';
import { authCacheKey } from '../auth-cache.util';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly cacheTtlSeconds: number;

  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
    this.cacheTtlSeconds = Number(configService.get<string>('AUTH_CACHE_TTL_SECONDS', '300'));
  }

  // Cache-aside: a hit here skips Postgres entirely. Any future action that
  // bans a user or changes their role must delete authCacheKey(userId) so
  // that takes effect on the next request instead of waiting out the TTL.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const cacheKey = authCacheKey(payload.sub);
    const cached = await this.redisService.getJson<AuthenticatedUser>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const company = await this.companiesService.findById(user.companyId);
    if (!company || !company.isActive) {
      throw new UnauthorizedException();
    }

    const authenticatedUser: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      displayName: user.displayName,
    };
    await this.redisService.setJson(cacheKey, authenticatedUser, this.cacheTtlSeconds);
    return authenticatedUser;
  }
}
