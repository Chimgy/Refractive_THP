import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // The embed beacon posts as text/plain (see telemetry-script.ts — this
  // sidesteps CORS preflight entirely, since arbitrary third-party sites
  // send this, not just our own frontend). Parse the body as raw text
  // regardless of declared content-type; the controller JSON.parses it.
  app.use('/telemetry', express.text({ type: '*/*', limit: '64kb' }));

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService
      .get<string>('CORS_ORIGIN', 'http://localhost:5173')
      .split(','),
    credentials: true,
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
