import { ConflictException, BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { CheckoutService } from '@/modules/checkout/checkout.service';
import { prismaUniqueViolation } from './support/prisma-mock';

function createPrismaMock() {
  const tx = {
    order: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    inventoryItem: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (txArg: typeof tx) => unknown) => fn(tx)),
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  return { prisma, tx };
}

function createErpMock() {
  return {
    placeOrder: jest.fn(),
  };
}

describe('CheckoutService', () => {
  it('should generate idempotencyKey when header is missing', async () => {
    const { prisma, tx } = createPrismaMock();
    const erp = createErpMock();

    tx.order.findUnique.mockResolvedValue(null);
    tx.product.findUnique.mockResolvedValue({ id: 'p1' });
    tx.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({
      id: 'o1',
      status: OrderStatus.PENDING,
    });

    const service = new CheckoutService(prisma as any, erp as any);

    const result = await service.createCheckoutAttempt({
      idempotencyKey: undefined,
      productId: 'p1',
      quantity: 1,
    });

    expect(result.orderId).toBe('o1');
    expect(result.idempotencyKey).toEqual(expect.any(String));
    expect(result.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('returns existing order for same idempotencyKey', async () => {
    const { prisma, tx } = createPrismaMock();
    const erp = createErpMock();

    tx.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: OrderStatus.PENDING,
    });

    const service = new CheckoutService(prisma as any, erp as any);
    const result = await service.createCheckoutAttempt({
      idempotencyKey: 'idem-1',
      productId: 'p1',
      quantity: 1,
    });

    expect(result).toEqual({
      orderId: 'o1',
      status: OrderStatus.PENDING,
      idempotencyKey: 'idem-1',
    });
    expect(tx.inventoryItem.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('fails with VALIDATION_ERROR for unknown productId', async () => {
    const { prisma, tx } = createPrismaMock();
    const erp = createErpMock();

    tx.order.findUnique.mockResolvedValue(null);
    tx.product.findUnique.mockResolvedValue(null);

    const service = new CheckoutService(prisma as any, erp as any);

    await expect(
      service.createCheckoutAttempt({
        idempotencyKey: 'idem-1',
        productId: 'missing',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws INSUFFICIENT_STOCK when inventory is not enough', async () => {
    const { prisma, tx } = createPrismaMock();
    const erp = createErpMock();

    tx.order.findUnique.mockResolvedValue(null);
    tx.product.findUnique.mockResolvedValue({ id: 'p1' });
    tx.inventoryItem.updateMany.mockResolvedValue({ count: 0 });
    tx.inventoryItem.findUnique.mockResolvedValue({ available: 2 });

    const service = new CheckoutService(prisma as any, erp as any);

    await expect(
      service.createCheckoutAttempt({
        idempotencyKey: 'idem-1',
        productId: 'p1',
        quantity: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates order and reserves inventory atomically', async () => {
    const { prisma, tx } = createPrismaMock();
    const erp = createErpMock();

    tx.order.findUnique.mockResolvedValue(null);
    tx.product.findUnique.mockResolvedValue({ id: 'p1' });
    tx.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({
      id: 'o1',
      status: OrderStatus.PENDING,
    });

    const service = new CheckoutService(prisma as any, erp as any);

    const result = await service.createCheckoutAttempt({
      idempotencyKey: 'idem-1',
      productId: 'p1',
      quantity: 2,
    });

    expect(result).toEqual({
      orderId: 'o1',
      status: OrderStatus.PENDING,
      idempotencyKey: 'idem-1',
    });
    expect(tx.inventoryItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'p1', available: { gte: 2 } },
        data: { available: { decrement: 2 } },
      }),
    );
  });

  it('handles idempotency race via Prisma P2002', async () => {
    const { prisma, tx } = createPrismaMock();
    const erp = createErpMock();

    tx.order.findUnique.mockResolvedValue(null);
    tx.product.findUnique.mockResolvedValue({ id: 'p1' });
    tx.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockRejectedValue(prismaUniqueViolation());

    prisma.order.findUnique.mockResolvedValue({
      id: 'o-race',
      status: OrderStatus.PROCESSING,
    });

    const service = new CheckoutService(prisma as any, erp as any);

    const result = await service.createCheckoutAttempt({
      idempotencyKey: 'idem-1',
      productId: 'p1',
      quantity: 1,
    });

    expect(result).toEqual({
      orderId: 'o-race',
      status: OrderStatus.PROCESSING,
      idempotencyKey: 'idem-1',
    });
  });

  it('rethrows when idempotency race cannot find existing order', async () => {
    const { prisma, tx } = createPrismaMock();
    const erp = createErpMock();

    tx.order.findUnique.mockResolvedValue(null);
    tx.product.findUnique.mockResolvedValue({ id: 'p1' });
    tx.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockRejectedValue(prismaUniqueViolation());

    prisma.order.findUnique.mockResolvedValue(null);

    const service = new CheckoutService(prisma as any, erp as any);

    await expect(
      service.createCheckoutAttempt({
        idempotencyKey: 'idem-1',
        productId: 'p1',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});
