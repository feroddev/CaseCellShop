import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { CheckoutService } from '@/modules/checkout/checkout.service';

function createPrismaMockForConcurrency(available: number) {
  let stock = available;
  const orders: Array<{ id: string; idempotencyKey: string }> = [];
  let orderSeq = 0;

  const tx = {
    order: {
      findUnique: jest.fn(async ({ where }: { where: { idempotencyKey: string } }) =>
        orders.find((o) => o.idempotencyKey === where.idempotencyKey) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: { idempotencyKey: string } }) => {
        const id = `o-${++orderSeq}`;
        orders.push({ id, idempotencyKey: data.idempotencyKey });
        return { id, status: OrderStatus.PENDING };
      }),
    },
    product: {
      findUnique: jest.fn(async () => ({ id: 'p1' })),
    },
    inventoryItem: {
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { productId: string; available: { gte: number } };
          data: { available: { decrement: number } };
        }) => {
          const qty = data.available.decrement;
          if (stock < where.available.gte || stock < qty) return { count: 0 };
          stock -= qty;
          return { count: 1 };
        },
      ),
      findUnique: jest.fn(async () => ({ available: stock })),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (txArg: typeof tx) => unknown) => fn(tx)),
    order: { findUnique: jest.fn() },
  };

  return { prisma, tx, getStock: () => stock, getOrderCount: () => orders.length };
}

describe('CheckoutService concurrency', () => {
  it('should not oversell under concurrent checkouts', async () => {
    const { prisma, getStock, getOrderCount } = createPrismaMockForConcurrency(2);
    const erp = { placeOrder: jest.fn() };
    const service = new CheckoutService(prisma as any, erp as any);

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        service.createCheckoutAttempt({
          idempotencyKey: `idem-${i}`,
          productId: 'p1',
          quantity: 1,
        }),
      ),
    );

    const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
    const rejected = attempts.filter(
      (a) => a.status === 'rejected' && a.reason instanceof ConflictException,
    );

    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(3);
    expect(getOrderCount()).toBe(2);
    expect(getStock()).toBe(0);
  });
});
