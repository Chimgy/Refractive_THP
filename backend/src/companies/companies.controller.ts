import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { RedisService } from '../redis/redis.service';
import { authCacheKey } from '../auth/auth-cache.util';
import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service';
import { toSafeUser } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { CompaniesService } from './companies.service';
import { CompanyInvitesService } from './company-invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyInvitesService: CompanyInvitesService,
    private readonly usersService: UsersService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly redisService: RedisService,
  ) {}

  @Roles('admin')
  @Post('invites')
  createInvite(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateInviteDto) {
    return this.companyInvitesService.create(admin.companyId, dto.role ?? 'member', admin.userId);
  }

  @Roles('admin')
  @Get('invites')
  async listInvites(@CurrentUser() admin: AuthenticatedUser) {
    const invites = await this.companyInvitesService.findByCompany(admin.companyId);
    return invites.map(({ tokenHash: _tokenHash, ...rest }) => rest);
  }

  @Roles('admin')
  @Patch('invites/:inviteId/revoke')
  async revokeInvite(@CurrentUser() admin: AuthenticatedUser, @Param('inviteId') inviteId: string) {
    await this.companyInvitesService.revoke(admin.companyId, inviteId);
    return { status: 'revoked' };
  }

  @Get('members')
  async listMembers(@CurrentUser() user: AuthenticatedUser) {
    const members = await this.usersService.findByCompany(user.companyId);
    return members.map(toSafeUser);
  }

  @Roles('admin')
  @Patch('members/:userId/ban')
  async ban(@CurrentUser() admin: AuthenticatedUser, @Param('userId') userId: string) {
    if (userId === admin.userId) {
      throw new BadRequestException('Cannot ban your own account');
    }

    const target = await this.usersService.findById(userId);
    if (!target || target.companyId !== admin.companyId) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.setActive(userId, false);
    await this.refreshTokensService.revokeAllForUser(userId);
    await this.redisService.del(authCacheKey(userId));

    return { status: 'banned' };
  }

  @Roles('admin')
  @Patch('members/:userId/unban')
  async unban(@CurrentUser() admin: AuthenticatedUser, @Param('userId') userId: string) {
    const target = await this.usersService.findById(userId);
    if (!target || target.companyId !== admin.companyId) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.setActive(userId, true);

    return { status: 'active' };
  }

  // Kills every member's session immediately, same technique as ban(): revoke
  // all refresh tokens and evict each Redis cache entry so the very next
  // request per user is a guaranteed cache-miss that re-checks company.isActive.
  @Roles('admin')
  @Patch('deactivate')
  async deactivateCompany(@CurrentUser() admin: AuthenticatedUser) {
    const members = await this.usersService.findByCompany(admin.companyId);

    await this.companiesService.deactivate(admin.companyId);

    await Promise.all(
      members.map(async (member) => {
        await this.refreshTokensService.revokeAllForUser(member.id);
        await this.redisService.del(authCacheKey(member.id));
      }),
    );

    return { status: 'deactivated' };
  }
}
