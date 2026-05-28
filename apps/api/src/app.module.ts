import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from '@/infra/prisma/prisma.module';
import { CatalogModule } from '@/modules/catalog/catalog.module';
import { CheckoutModule } from '@/modules/checkout/checkout.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    CatalogModule,
    CheckoutModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
