import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { CheckoutService } from './checkout.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class CheckoutWorker implements OnModuleInit {
  private readonly logger = new Logger(CheckoutWorker.name);

  // simple worker config for the challenge (no Redis initially)
  private readonly pollIntervalMs = 800;
  private readonly batchSize = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkoutService: CheckoutService,
  ) {}

  onModuleInit() {
    setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  private async tick() {
    const pending = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize,
    });

    for (const order of pending) {
      try {
        await this.checkoutService.processPendingOrder(order.id);
        this.logger.log(
          JSON.stringify({
            message: 'Order processed',
            orderId: order.id,
          }),
        );
      } catch (e) {
        // We intentionally keep the worker running; errors are reflected in order state.
        this.logger.warn(
          JSON.stringify({
            message: 'Order processing failed',
            orderId: order.id,
            error: e instanceof Error ? e.message : 'unknown',
          }),
        );
      }
    }
  }
}
