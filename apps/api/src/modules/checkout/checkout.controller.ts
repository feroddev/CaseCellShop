import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CheckoutService } from './checkout.service';

@Controller()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('/checkout')
  async createCheckoutAttempt(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.checkoutService.createCheckoutAttempt({
      idempotencyKey,
      productId: dto.productId,
      quantity: dto.quantity,
    });
  }

  @Get('/orders/:id')
  async getOrderStatus(@Param('id') orderId: string) {
    const order = await this.checkoutService.getOrder(orderId);
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND' });
    return order;
  }
}
