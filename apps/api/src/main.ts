import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    // Browsers send the origin without a trailing slash, so a pasted "https://site.app/" must not break the match.
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').trim().replace(/\/+$/, ''),
    credentials: true,
  });
  // whitelist strips unknown fields so clients cannot set columns like userId.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
