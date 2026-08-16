import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { InternalModule } from './internal/internal.module';
import { ProjectsModule } from './projects/projects.module';
import { RedisModule } from './redis/redis.module';
import { RefreshTokensModule } from './refresh-tokens/refresh-tokens.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { dataSourceOptions } from './database/data-source';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
      // Schema changes now only ship via migrations (backend/src/database/migrations) —
      // synchronize is off everywhere, not just production, so dev never drifts
      // from what a real migration would produce.
      synchronize: false,
    }),
    RedisModule,
    // Root BullMQ connection — a dedicated ioredis client, not the shared one
    // from RedisModule. BullMQ's blocking commands need
    // `maxRetriesPerRequest: null`, which isn't something the general-purpose
    // client (counters, HLL, auth cache) should also be forced into. Same
    // host/port/password/TLS as RedisModule, just a separate connection.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<string>('REDIS_PORT', '6379')),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          tls:
            configService.get<string>('REDIS_TLS', 'false') === 'true'
              ? {}
              : undefined,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    UsersModule,
    RefreshTokensModule,
    AuthModule,
    TenantModule,
    InternalModule,
    TelemetryModule,
    // Auth silo needs no prefix (AuthController is already `/api/auth/*`).
    // Tenant/Internal silos get their prefix applied here, at the module
    // boundary, so the silo IS the module boundary — the seam needed to
    // later extract one into its own deployable.
    //
    // TelemetryModule is a fourth silo, deliberately left out of
    // RouterModule.register below and out of the global `api` prefix
    // entirely (see main.ts) — its routes (GET /THP_analytics.js,
    // POST /telemetry) are embedded in third-party HTML and can't be
    // versioned or moved the way tenant/internal routes can.
    //
    // RouterModule only tags the exact module class(es) listed — it does NOT
    // walk a module's own `imports` — so every module that actually declares
    // controllers must be listed explicitly, either as the `module` or in
    // `children` (children inherit the parent path). TenantModule itself
    // declares no controllers; CompaniesModule/ProjectsModule do, so they're
    // listed here too. Any future tenant-facing module needs adding to BOTH
    // TenantModule's `imports` and this `children` array.
    RouterModule.register([
      {
        path: 'tenant',
        module: TenantModule,
        children: [CompaniesModule, ProjectsModule],
      },
      { path: 'internal', module: InternalModule },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
