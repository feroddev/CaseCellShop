export type Product = {
  id: string;
  name: string;
  priceCents: number;
  available: number;
};

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED';
export type OrderFailureCode =
  | 'VALIDATION_ERROR'
  | 'INSUFFICIENT_STOCK'
  | 'ERP_TEMPORARY'
  | 'ERP_PERMANENT'
  | 'TECHNICAL_FAILURE'
  | 'NOT_FOUND'
  | null;

export type OrderStatusResponse = {
  orderId: string;
  status: OrderStatus;
  failureCode?: OrderFailureCode;
  erpAttempts?: number;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};

const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:3000';

export async function listProducts(): Promise<Product[]> {
  const res = await fetch(`${baseUrl}/products`, { cache: 'no-store' });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

export async function createCheckoutAttempt(input: {
  idempotencyKey?: string;
  productId: string;
  quantity: number;
}): Promise<{ orderId: string; status: OrderStatus; idempotencyKey: string }> {
  const res = await fetch(`${baseUrl}/checkout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(input.idempotencyKey ? { 'idempotency-key': input.idempotencyKey } : {}),
    },
    body: JSON.stringify({ productId: input.productId, quantity: input.quantity }),
  });

  if (!res.ok) throw await toApiError(res);
  return res.json();
}

export async function getOrderWithKey(input: {
  orderId: string;
  idempotencyKey: string;
}): Promise<OrderStatusResponse> {
  const res = await fetch(
    `${baseUrl}/orders/${encodeURIComponent(input.orderId)}`,
    {
    headers: {
      'idempotency-key': input.idempotencyKey,
    },
    cache: 'no-store',
    },
  );
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

async function toApiError(res: Response): Promise<ApiErrorBody> {
  try {
    return (await res.json()) as ApiErrorBody;
  } catch {
    return { code: 'TECHNICAL_FAILURE', message: `HTTP ${res.status}` };
  }
}

