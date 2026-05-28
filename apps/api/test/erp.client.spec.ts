import { ConfigService } from '@nestjs/config';
import { ErpClient, ErpTemporaryError } from '@/modules/erp/erp.client';

describe('ErpClient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('waits for configured delay range before resolving', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'ERP_MIN_DELAY_MS') return 10;
        if (key === 'ERP_MAX_DELAY_MS') return 11;
        if (key === 'ERP_FAILURE_RATE') return 0;
        return undefined;
      }),
    } satisfies Partial<ConfigService>;

    // Make delay deterministic: random => 0 so delay=min
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const client = new ErpClient(config as ConfigService);
    const promise = client.placeOrder({
      orderId: 'o1',
      productId: 'p1',
      quantity: 1,
    });

    // Not resolved until timers run
    let settled = false;
    void promise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    jest.advanceTimersByTime(10);
    await expect(promise).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });

  it('throws ErpTemporaryError when failure rate triggers', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'ERP_MIN_DELAY_MS') return 1;
        if (key === 'ERP_MAX_DELAY_MS') return 2;
        if (key === 'ERP_FAILURE_RATE') return 1; // always fail
        return undefined;
      }),
    } satisfies Partial<ConfigService>;

    jest.spyOn(Math, 'random').mockReturnValue(0);

    const client = new ErpClient(config as ConfigService);
    const promise = client.placeOrder({
      orderId: 'o1',
      productId: 'p1',
      quantity: 1,
    });

    jest.advanceTimersByTime(1);

    await expect(promise).rejects.toBeInstanceOf(ErpTemporaryError);
  });

  it('uses defaults when config is missing and handles maxDelay < minDelay', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'ERP_MIN_DELAY_MS') return 20;
        if (key === 'ERP_MAX_DELAY_MS') return 10; // inverted
        if (key === 'ERP_FAILURE_RATE') return undefined; // default 0.3
        return undefined;
      }),
    } satisfies Partial<ConfigService>;

    // First random for delay component; second random for failure check.
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.9) // delay component (should be clamped)
      .mockReturnValueOnce(0.99); // do not fail (default failure rate 0.3)

    const client = new ErpClient(config as ConfigService);
    const promise = client.placeOrder({
      orderId: 'o1',
      productId: 'p1',
      quantity: 1,
    });

    // With maxDelay < minDelay, delta is clamped to 0 -> delay = minDelay
    jest.advanceTimersByTime(19);
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(1);
    await expect(promise).resolves.toBeUndefined();
  });
});
