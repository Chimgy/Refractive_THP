import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Placeholder for the Internal silo (`/api/internal`) — nothing internal-only
// exists yet, but every route added here should default to at least
// admin-gated auth, ahead of any real network isolation later.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InternalController {
  @Roles('admin')
  @Get('ping')
  ping() {
    return { status: 'ok', silo: 'internal' };
  }
}
