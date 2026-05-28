import { OrderStatus } from '@prisma/client';
import { CheckoutService } from '@/modules/checkout/checkout.service';
import { ErpTemporaryError } from '@/modules/erp/erp.client';

function createPrismaOrderProcessingMock(orderOverrides?: Partial<any>) {
  const order = {
    id: 'o1',
    status: OrderStatus.PENDING,
    productId: 'p1',
    quantity: 1,
    ...orderOverrides,
  };

  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  return { prisma, order };
}

describe('CheckoutService.processPendingOrder', () => {
  it('marks order as CONFIRMED after ERP success', async () => {
    const { prisma } = createPrismaOrderProcessingMock();
    const erp = { placeOrder: jest.fn().mockResolvedValue(undefined) };
    const service = new CheckoutService(prisma as any, erp as any);

    await service.processPendingOrder('o1');

    expect(prisma.order.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'o1' },
      data: { status: OrderStatus.PROCESSING },
    });

    expect(prisma.order.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'o1' },
      data: {
        status: OrderStatus.CONFIRMED,
        failureCode: null,
        lastError: null,
      },
    });
  });

  it('keeps order as PENDING and increments attempts on ERP temporary failure', async () => {
    const { prisma } = createPrismaOrderProcessingMock();
    const erp = {
      placeOrder: jest.fn().mockRejectedValue(new ErpTemporaryError('temp')),
    };
    const service = new CheckoutService(prisma as any, erp as any);

    await service.processPendingOrder('o1');

    expect(prisma.order.update).toHaveBeenLastCalledWith({
      where: { id: 'o1' },
      data: {
        status: OrderStatus.PENDING,
        failureCode: 'ERP_TEMPORARY',
        lastError: 'temp',
        erpAttempts: { increment: 1 },
      },
    });
  });

  it('marks order as FAILED on unexpected error', async () => {
    const { prisma } = createPrismaOrderProcessingMock();
    const erp = {
      placeOrder: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const service = new CheckoutService(prisma as any, erp as any);

    await service.processPendingOrder('o1');

    expect(prisma.order.update).toHaveBeenLastCalledWith({
      where: { id: 'o1' },
      data: {
        status: OrderStatus.FAILED,
        failureCode: 'TECHNICAL_FAILURE',
        lastError: 'boom',
        erpAttempts: { increment: 1 },
      },
    });
  });

  it('does nothing if order is already CONFIRMED', async () => {
    const { prisma } = createPrismaOrderProcessingMock({
      status: OrderStatus.CONFIRMED,
    });
    const erp = { placeOrder: jest.fn() };
    const service = new CheckoutService(prisma as any, erp as any);

    await service.processPendingOrder('o1');

    expect(erp.placeOrder).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('returns null from getOrder when not found', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const erp = { placeOrder: jest.fn() };
    const service = new CheckoutService(prisma as any, erp as any);

    await expect(service.getOrder('missing')).resolves.toBeNull();
  });

  it('returns shaped order status from getOrder when found', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o1',
          status: OrderStatus.PENDING,
          failureCode: null,
          erpAttempts: 2,
        }),
      },
    };
    const erp = { placeOrder: jest.fn() };
    const service = new CheckoutService(prisma as any, erp as any);

    await expect(service.getOrder('o1')).resolves.toEqual({
      orderId: 'o1',
      status: OrderStatus.PENDING,
      failureCode: null,
      erpAttempts: 2,
    });
  });
});
