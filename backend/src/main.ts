import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // NestExpressApplication (instead of the default) unlocks
  // Express-specific features we need — specifically useStaticAssets
  // below, for serving uploaded avatar images back out to the browser.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ValidationPipe());

  // Enables the backend to actually read cookies sent by the browser
  // (e.g. our auth_token cookie). Without this, req.cookies would always
  // be undefined, even though the browser is sending the cookie fine.
  app.use(cookieParser());

  // Serves everything inside backend/uploads/ as plain static files,
  // reachable at http://localhost:3001/uploads/... . This is how an
  // <img src="/uploads/avatars/xyz.jpg"> tag on the frontend actually
  // gets real image bytes back — Nest isn't running any of our own
  // route handler code for these, it's just handing back the raw file.
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Allows our frontend (running on a different port, localhost:3000) to
  // make requests to this backend. Without this, the browser blocks the
  // request before it even reaches our routes — a built-in browser
  // security feature (CORS) that stops random websites from silently
  // calling APIs on your behalf. Locking this to our exact frontend
  // origin (rather than allowing "*" / any origin) is the safer default.
  //
  // credentials: true is required for cookies specifically — without it,
  // the browser will silently refuse to send or store our auth_token
  // cookie on cross-origin requests, even though everything else works.
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();