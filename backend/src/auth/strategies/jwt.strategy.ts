import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { JwtPayload } from '../types/jwt-payload.type';

// Cheap path: trusts the signed, unexpired payload as-is — no DB/Redis I/O.
// This means role/isActive/ban state can be stale for up to JWT_EXPIRES_IN.
// Routes where that staleness window is unacceptable (ban, unban, deactivate,
// invite create/revoke) opt into LiveAuthGuard on top of this, which does the
// instant-revocation check this strategy used to do for every route.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'dev-secret-change-me',
      ),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId,
      displayName: payload.displayName,
    };
  }
}
