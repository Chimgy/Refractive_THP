import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { CloudflareAccessUser } from '../types/cloudflare-access-user.type';

// Cloudflare Access sits in front of this app and attaches a signed JWT to
// every request that passed its login check, in the `Cf-Access-Jwt-Assertion`
// header. Trusting that header just because it's present would mean trusting
// whatever put it there — internal-backend shares `internal-net` with
// internal-frontend, so anything that can reach this container directly
// (container-to-container, a misconfigured port mapping) could forge the
// header. Verifying the signature against Cloudflare's own public JWKS
// (rotated automatically; fetched + cached here by `jose`) is what actually
// proves the request came through Access, not just claims to have.
@Injectable()
export class CloudflareAccessGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

  constructor(private readonly configService: ConfigService) {}

  private getJwks(teamDomain: string) {
    this.jwks ??= createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
    );
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: CloudflareAccessUser }>();
    const token = request.headers['cf-access-jwt-assertion'];

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Missing Cloudflare Access assertion');
    }

    const teamDomain = this.configService.getOrThrow<string>(
      'CF_ACCESS_TEAM_DOMAIN',
    );
    const audience = this.configService.getOrThrow<string>('CF_ACCESS_AUD');

    try {
      const { payload } = await jwtVerify(token, this.getJwks(teamDomain), {
        issuer: `https://${teamDomain}`,
        audience,
      });

      if (typeof payload.email !== 'string') {
        throw new UnauthorizedException(
          'Cloudflare Access assertion missing email claim',
        );
      }

      request.user = { email: payload.email, sub: payload.sub ?? '' };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid Cloudflare Access assertion');
    }
  }
}
