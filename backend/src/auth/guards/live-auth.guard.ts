import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CompaniesService } from '../../companies/companies.service';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/users.service';
import { authCacheKey } from '../auth-cache.util';
import { REQUIRE_LIVE_AUTH_KEY } from '../decorators/require-live-auth.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.type';

// Opt-in instant-revocation check for admin-sensitive routes only. Everything
// else trusts the JWT signature/payload for its TTL (see JwtStrategy).
// A no-op (zero I/O) unless the handler/class carries @RequireLiveAuth() —
// same cost model as RolesGuard has for routes without @Roles().
//
// Cache-aside: a hit here skips Postgres entirely. ban()/unban()/
// deactivateCompany() must delete authCacheKey(userId) so a revocation takes
// effect on the very next request instead of waiting out the TTL.
@Injectable()
export class LiveAuthGuard implements CanActivate {
  private readonly cacheTtlSeconds: number;

  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly redisService: RedisService,
    configService: ConfigService,
  ) {
    this.cacheTtlSeconds = Number(
      configService.get<string>('AUTH_CACHE_TTL_SECONDS', '300'),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresLive = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_LIVE_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresLive) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const cacheKey = authCacheKey(userId);
    const cached = await this.redisService.getJson<AuthenticatedUser>(cacheKey);
    if (cached) {
      return true;
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const company = await this.companiesService.findById(user.companyId);
    if (!company || !company.isActive) {
      throw new UnauthorizedException();
    }

    await this.redisService.setJson(
      cacheKey,
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        displayName: user.displayName,
      },
      this.cacheTtlSeconds,
    );
    return true;
  }
}
