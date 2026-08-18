import { Injectable } from '@nestjs/common';
import { GithubJwtService } from './github-jwt.service';
import type { InstallationAccessTokenResponse } from './types/github-api.types';

// in lou of redis for now -- probs just change tonight wont be hard to set up with bullMQ already in place
interface CachedToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class GithubInstallationTokenService {
  private tokenCache = new Map<string, CachedToken>();

  constructor(private githubJwtService: GithubJwtService) {}

  async getToken(installationId: string): Promise<string> {
    const cached = this.tokenCache.get(installationId);
    if (cached && cached.expiresAt.getTime() - Date.now() > 2 * 60 * 1000) {
      return cached.token;
    }
    // otherwise go grab it
    return this.fetchAndCacheToken(installationId);
  }

  async fetchAndCacheToken(installationId: string): Promise<string> {
    const appJwt = this.githubJwtService.createAppJwt();

    const res = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-Github-Api-Version': '2022-11-28',
        },
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to get installation token: ${res.status}`);
    }

    const data = (await res.json()) as InstallationAccessTokenResponse;
    const result: CachedToken = {
      token: data.token,
      expiresAt: new Date(data.expires_at),
    };
    this.tokenCache.set(installationId, result);
    return result.token;
  }
}
