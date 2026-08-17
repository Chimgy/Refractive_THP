import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CloudflareAccessGuard } from './guards/cloudflare-access.guard';

// Registers CloudflareAccessGuard as a global guard (APP_GUARD) — every
// route in this app requires a valid Cloudflare Access assertion by
// default, since there's no other user population or local auth here.
@Module({
  providers: [{ provide: APP_GUARD, useClass: CloudflareAccessGuard }],
})
export class AuthModule {}
