import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { requestIdMiddleware } from '@/infra/http/request-id.middleware';
import { HttpExceptionToApiErrorFilter } from '@/infra/http/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(requestIdMiddleware);
  app.useGlobalFilters(new HttpExceptionToApiErrorFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
