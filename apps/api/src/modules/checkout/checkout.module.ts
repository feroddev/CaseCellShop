import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { ErpModule } from '@/modules/erp/erp.module';
import { CheckoutWorker } from './checkout.worker';

@Module({
  imports: [ErpModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CheckoutWorker],
  exports: [CheckoutService],
})
export class CheckoutModule {}
