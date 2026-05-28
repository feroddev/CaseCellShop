const STORAGE_KEY = 'casecellshop.checkout.attempt';

type PersistedAttempt = {
  idempotencyKey: string;
  productId: string;
  quantity: number;
  createdAt: string;
};

export function getAttemptForPayload(input: {
  productId: string;
  quantity: number;
}): PersistedAttempt | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAttempt;
    if (
      !parsed?.idempotencyKey ||
      parsed.productId !== input.productId ||
      parsed.quantity !== input.quantity
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getLatestAttempt(): PersistedAttempt | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAttempt;
    if (!parsed?.idempotencyKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistAttempt(attempt: {
  idempotencyKey: string;
  productId: string;
  quantity: number;
}) {
  if (typeof window === 'undefined') return;
  const payload: PersistedAttempt = {
    ...attempt,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearAttempt() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

