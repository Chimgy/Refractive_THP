import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { CloudflareZoneLink } from './entities/cloudflare-zone-link.entity';
import {
  decryptCloudflareToken,
  encryptCloudflareToken,
} from './cloudflare-token-crypto.util';

export type LinkedZone = { projectId: string; zoneId: string; apiToken: string };

// Same "insecure default + loud warning" shape as
// TelemetryUniquesService's TELEMETRY_HASH_SECRET handling — a fixed dev
// fallback so the app still boots locally without a real
// CLOUDFLARE_TOKEN_ENC_KEY, but never silently in production. Derived via
// SHA-256 (always exactly 32 bytes) rather than a hand-picked base64
// literal, so there's no risk of the fallback itself being the wrong length
// for AES-256.
const INSECURE_DEFAULT_KEY = createHash('sha256')
  .update('dev-cloudflare-token-key-change-me')
  .digest();

@Injectable()
export class CloudflareZoneLinkService {
  private readonly logger = new Logger(CloudflareZoneLinkService.name);
  private readonly encKey: Buffer;

  constructor(
    @InjectRepository(CloudflareZoneLink)
    private readonly links: Repository<CloudflareZoneLink>,
    configService: ConfigService,
  ) {
    const configured = configService.get<string>('CLOUDFLARE_TOKEN_ENC_KEY');
    if (!configured) {
      this.logger.warn(
        'CLOUDFLARE_TOKEN_ENC_KEY is not set — using the insecure hardcoded default. Set it in .env.',
      );
      this.encKey = INSECURE_DEFAULT_KEY;
    } else {
      const key = Buffer.from(configured, 'base64');
      if (key.length !== 32) {
        // Fail fast with a clear message — createCipheriv would otherwise
        // throw a much less obvious error the first time a token is
        // encrypted, possibly long after boot.
        throw new Error(
          `CLOUDFLARE_TOKEN_ENC_KEY must decode to exactly 32 bytes (got ${key.length}) — generate one with e.g. \`openssl rand -base64 32\`.`,
        );
      }
      this.encKey = key;
    }
  }

  async link(
    projectId: string,
    zoneId: string,
    apiToken: string,
  ): Promise<void> {
    const { ciphertext, iv } = encryptCloudflareToken(this.encKey, apiToken);
    await this.links.upsert(
      { projectId, zoneId, apiTokenEncrypted: ciphertext, apiTokenIv: iv },
      ['projectId'],
    );
  }

  async unlink(projectId: string): Promise<void> {
    await this.links.delete({ projectId });
  }

  // Config-presence check, not a health probe — used by the dashboard's
  // "Connections" widget to show whether a zone is linked at all, not
  // whether Cloudflare's API is currently reachable. zoneId is safe to
  // return (not a secret); the token never is.
  async getStatus(
    projectId: string,
  ): Promise<{ linked: boolean; zoneId: string | null }> {
    const link = await this.links.findOne({ where: { projectId } });
    return { linked: link !== null, zoneId: link?.zoneId ?? null };
  }

  // Used by TelemetryCloudflarePullProcessor's per-tick sweep — every
  // project with a link, token decrypted and ready to call Cloudflare's
  // GraphQL API with. Never exposed back over the tenant API (see
  // projects.controller.ts's link endpoint, which never echoes the token).
  async findAllLinked(): Promise<LinkedZone[]> {
    const rows = await this.links.find();
    return rows.map((row) => ({
      projectId: row.projectId,
      zoneId: row.zoneId,
      apiToken: decryptCloudflareToken(
        this.encKey,
        row.apiTokenEncrypted,
        row.apiTokenIv,
      ),
    }));
  }
}
