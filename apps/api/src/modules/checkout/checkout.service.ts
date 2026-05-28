import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { ErpClient, ErpTemporaryError } from '@/modules/erp/erp.client';

type CreateCheckoutAttemptInput = {
  idempotencyKey: string | undefined;
  productId: string;
  quantity: number;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erpClient: ErpClient,
  ) {}

  async createCheckoutAttempt(input: CreateCheckoutAttemptInput) {
    const idempotencyKey = input.idempotencyKey?.trim();
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Missing Idempotency-Key header',
      });
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          return { orderId: existing.id, status: existing.status };
        }

        const product = await tx.product.findUnique({
          where: { id: input.productId },
        });
        if (!product) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Unknown productId',
          });
        }

        const updated = await tx.inventoryItem.updateMany({
          where: {
            productId: input.productId,
            available: { gte: input.quantity },
          },
          data: {
            available: { decrement: input.quantity },
          },
        });

        if (updated.count === 0) {
          const inv = await tx.inventoryItem.findUnique({
            where: { productId: input.productId },
          });

          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message: 'Not enough stock',
            available: inv?.available ?? 0,
          });
        }

        const order = await tx.order.create({
          data: {
            idempotencyKey,
            productId: input.productId,
            quantity: input.quantity,
            status: OrderStatus.PENDING,
          },
        });

        return { orderId: order.id, status: order.status };
      });

      return result;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint on idempotencyKey can race under concurrency
        if (err.code === 'P2002') {
          const existing = await this.prisma.order.findUnique({
            where: { idempotencyKey },
          });
          if (existing)
            return { orderId: existing.id, status: existing.status };
        }
      }
      throw err;
    }
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) return null;

    return {
      orderId: order.id,
      status: order.status,
      failureCode: order.failureCode,
      erpAttempts: order.erpAttempts,
    };
  }

  /**
   * Processes a single order attempt against the ERP simulation.
   * This is invoked by the internal worker (no external queue initially).
   */
  async processPendingOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) return;

    if (
      order.status === OrderStatus.CONFIRMED ||
      order.status === OrderStatus.FAILED
    ) {
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PROCESSING },
    });

    try {
      await this.erpClient.placeOrder({
        orderId: order.id,
        productId: order.productId,
        quantity: order.quantity,
      });

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          failureCode: null,
          lastError: null,
        },
      });
    } catch (e) {
      if (e instanceof ErpTemporaryError) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PENDING,
            failureCode: 'ERP_TEMPORARY',
            lastError: e.message,
            erpAttempts: { increment: 1 },
          },
        });
        return;
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.FAILED,
          failureCode: 'TECHNICAL_FAILURE',
          lastError: e instanceof Error ? e.message : 'Unknown error',
          erpAttempts: { increment: 1 },
        },
      });
      return;
    }
  }
}
