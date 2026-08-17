import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { CloudflareAccessUser } from '../types/cloudflare-access-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CloudflareAccessUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: CloudflareAccessUser }>();
    return request.user;
  },
);
