import { CheckoutWorker } from '@/modules/checkout/checkout.worker';
import { OrderStatus } from '@prisma/client';

describe('CheckoutWorker', () => {
  it('processes pending orders in order and logs successes', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'o1', status: OrderStatus.PENDING, createdAt: new Date(1) },
          { id: 'o2', status: OrderStatus.PENDING, createdAt: new Date(2) },
        ]),
      },
    };

    const checkoutService = {
      processPendingOrder: jest.fn().mockResolvedValue(undefined),
    };

    const worker = new CheckoutWorker(prisma as any, checkoutService as any);

    const logSpy = jest
      .spyOn((worker as any).logger, 'log')
      .mockImplementation(() => {});

    await (worker as any).tick();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: OrderStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        take: expect.any(Number),
      }),
    );
    expect(checkoutService.processPendingOrder).toHaveBeenNthCalledWith(
      1,
      'o1',
    );
    expect(checkoutService.processPendingOrder).toHaveBeenNthCalledWith(
      2,
      'o2',
    );
    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  it('logs warnings when processing fails and keeps running', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([{ id: 'o1' }]),
      },
    };

    const checkoutService = {
      processPendingOrder: jest.fn().mockRejectedValue(new Error('boom')),
    };

    const worker = new CheckoutWorker(prisma as any, checkoutService as any);

    const warnSpy = jest
      .spyOn((worker as any).logger, 'warn')
      .mockImplementation(() => {});

    await (worker as any).tick();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(checkoutService.processPendingOrder).toHaveBeenCalledWith('o1');
  });
});
