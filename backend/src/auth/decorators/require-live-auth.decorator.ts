import { SetMetadata } from '@nestjs/common';

export const REQUIRE_LIVE_AUTH_KEY = 'requireLiveAuth';
export const RequireLiveAuth = () => SetMetadata(REQUIRE_LIVE_AUTH_KEY, true);
