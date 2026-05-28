import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class ErpTemporaryError extends Error {}

type PlaceOrderInput = {
  orderId: string;
  productId: string;
  quantity: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ErpClient {
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly temporaryFailureRate: number;

  constructor(private readonly config: ConfigService) {
    this.minDelayMs = Number(this.config.get('ERP_MIN_DELAY_MS') ?? 800);
    this.maxDelayMs = Number(this.config.get('ERP_MAX_DELAY_MS') ?? 2500);
    this.temporaryFailureRate = Number(
      this.config.get('ERP_FAILURE_RATE') ?? 0.3,
    );
  }

  async placeOrder(_input: PlaceOrderInput): Promise<void> {
    const delay =
      this.minDelayMs +
      Math.floor(
        Math.random() * Math.max(0, this.maxDelayMs - this.minDelayMs),
      );
    await sleep(delay);

    if (Math.random() < this.temporaryFailureRate) {
      throw new ErpTemporaryError('ERP temporarily unavailable');
    }
  }
}
