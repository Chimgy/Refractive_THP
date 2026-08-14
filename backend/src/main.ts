import { RequestMethod, ValidationPipe } from '@nestjs/common';
import type { CorsOptionsCallback } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Request } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());

  // Exactly one reverse proxy sits between the browser and this app right
  // now (Cloudflare's edge, whether via Tunnel or classic proxied DNS) — so
  // `req.ip`/`req.ips` resolve to the address that edge appended to
  // X-Forwarded-For, not anything the client itself can set. Bump this to 2
  // if CloudFront ever ends up in front of the ALB too (project-plan.md
  // §3). See client-ip.util.ts.
  app.set('trust proxy', 1);

  // The embed beacon posts as text/plain (see telemetry-script.ts — this
  // sidesteps CORS preflight entirely, since arbitrary third-party sites
  // send this, not just our own frontend). Parse the body as raw text
  // regardless of declared content-type; the controller JSON.parses it.
  app.use('/telemetry', express.text({ type: '*/*', limit: '64kb' }));

  const configService = app.get(ConfigService);
  const corsOrigins = configService
    .get<string>('CORS_ORIGIN', 'http://localhost:5173')
    .split(',');

  // Telemetry's two routes (GET /THP_analytics.js, POST /telemetry) are
  // deliberately excluded here — they're public-by-design (no session, no
  // credentials ever sent) and set their own Access-Control-Allow-Origin: *
  // on the controller. Letting the global `credentials: true` config also
  // apply to them would additionally stamp Access-Control-Allow-Credentials:
  // true on every response regardless of origin match — a spec-invalid
  // combination alongside `*`. Returning `{}` for those paths makes the
  // `cors` package skip adding any CORS headers at all, leaving the
  // controller's own header as the sole source of truth.
  app.enableCors((req: Request, callback: CorsOptionsCallback) => {
    const isTelemetryRoute =
      req.path === '/telemetry' || req.path === '/THP_analytics.js';
    callback(
      null,
      isTelemetryRoute ? {} : { origin: corsOrigins, credentials: true },
    );
  });

  // Telemetry routes are excluded from `api` — they're embedded in
  // third-party HTML (GET /THP_analytics.js, POST /telemetry) and need
  // stable, unprefixed, unversioned paths (see app.module.ts).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'THP_analytics.js', method: RequestMethod.GET },
      { path: 'telemetry', method: RequestMethod.POST },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // Throws an error if extra fields are sent
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Refractive THP API')
    .setDescription('Software Development Management Portal API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err: unknown) => {
  console.error('Failed to start application', err);
  process.exit(1);
});
