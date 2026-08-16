import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// One row per project (1:1) — links a project to the Cloudflare zone that
// fronts it, so TelemetryCloudflarePullProcessor knows where to pull
// httpRequestsAdaptiveGroups from (see edgelog-metric.entity.ts). `zoneId`
// is a Cloudflare zone tag, not a secret. `apiToken` is encrypted at rest
// (cloudflare-token-crypto.util.ts, AES-256-GCM under CLOUDFLARE_TOKEN_ENC_KEY)
// since — unlike telemetry's visitor-hash.util.ts, which only ever needs a
// one-way comparison — this token has to be recovered to call Cloudflare's
// API, so hashing it isn't an option.
@Entity('cloudflare_zone_links')
@Index(['projectId'], { unique: true })
export class CloudflareZoneLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar' })
  zoneId: string;

  @Column({ type: 'text' })
  apiTokenEncrypted: string;

  @Column({ type: 'text' })
  apiTokenIv: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
