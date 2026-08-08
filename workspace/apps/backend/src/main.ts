import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  });
  await app.listen(process.env.BACKEND_PORT ?? 3001);
}
bootstrap();
