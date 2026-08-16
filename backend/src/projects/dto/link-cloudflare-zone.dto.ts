import { IsNotEmpty, IsString } from 'class-validator';

export class LinkCloudflareZoneDto {
  @IsString()
  @IsNotEmpty()
  zoneId: string;

  // Never echoed back anywhere — see CloudflareZoneLinkService, which
  // encrypts this before it's persisted and only ever returns it decrypted
  // to TelemetryCloudflarePullProcessor's own outbound API calls.
  @IsString()
  @IsNotEmpty()
  apiToken: string;
}
