import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokensModule } from '../refresh-tokens/refresh-tokens.module';
import { UsersModule } from '../users/users.module';
import { CompanyInvitesService } from './company-invites.service';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyInvite } from './entities/company-invite.entity';
import { Company } from './entities/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyInvite]),
    UsersModule,
    RefreshTokensModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyInvitesService],
  exports: [CompaniesService, CompanyInvitesService],
})
export class CompaniesModule {}
