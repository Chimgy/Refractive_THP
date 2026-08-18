import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class GithubJwtService {
  private readonly appId: string;
  private readonly privateKey: string;

  constructor(configService: ConfigService) {
    const appId = configService.get<string>('GITHUB_APP_ID');
    const privateKeyPath = configService.get<string>('GITHUB_APP_PRIVATE_KEY');
    if (!appId || !privateKeyPath) {
      throw new Error(
        'GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must both be set.',
      );
    }
    this.appId = appId;
    // GITHUB_APP_PRIVATE_KEY holds a path to the .pem, not the key itself —
    // read once at boot so a missing/misplaced file fails fast here instead
    // of on the first JWT signed.
    this.privateKey = readFileSync(privateKeyPath, 'utf8');
  }

  createAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iat: now - 60, exp: now + 60 * 9, iss: this.appId },
      this.privateKey,
      { algorithm: 'RS256' },
    );
  }
}
