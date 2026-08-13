import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

// Centralizes the refresh-token cookie's options so every set/clear site
// agrees. SameSite=Strict is deliberate: this is a pure SPA — the cookie is
// only ever sent by same-origin fetch() calls the app's own JS makes, never
// by a cross-site top-level navigation or third-party form, so Strict's only
// real-world cost (withheld on cross-site top-level GET navigation) doesn't
// apply here. Backed independently by the CORS origin allow-list + JSON-only
// bodies, which a classic cross-site CSRF form can't produce without
// triggering a preflight CORS will reject.
//
// Prod requirement: SameSite is computed against the registrable domain
// (eTLD+1) — the frontend and backend must be deployed as subdomains of the
// same registrable domain (e.g. app.thp.com + api.thp.com) or this cookie
// will never be sent cross-origin at all.
@Injectable()
export class RefreshCookieService {
  private readonly name: string;
  private readonly domain?: string;
  private readonly secure: boolean;
  private readonly maxAgeMs: number;

  constructor(configService: ConfigService) {
    this.name = configService.get<string>(
      'REFRESH_TOKEN_COOKIE_NAME',
      'thp_refresh_token',
    );
    this.domain = configService.get<string>('COOKIE_DOMAIN') || undefined;
    this.secure = configService.get<string>('NODE_ENV') === 'production';
    const ttlDays = Number(
      configService.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'),
    );
    this.maxAgeMs = ttlDays * 24 * 60 * 60 * 1000;
  }

  attach(res: Response, token: string): void {
    res.cookie(this.name, token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'strict',
      path: '/api/auth',
      domain: this.domain,
      maxAge: this.maxAgeMs,
    });
  }

  clear(res: Response): void {
    res.clearCookie(this.name, { path: '/api/auth', domain: this.domain });
  }

  read(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[this.name];
  }
}
