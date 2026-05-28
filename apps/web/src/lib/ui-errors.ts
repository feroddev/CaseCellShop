import type { ApiErrorBody } from './api';

export function toHumanMessage(error: unknown): {
  title: string;
  description?: string;
  requestId?: string;
  code?: string;
} {
  const e = error as Partial<ApiErrorBody> | undefined;
  const code = typeof e?.code === 'string' ? e.code : undefined;
  const requestId = typeof e?.requestId === 'string' ? e.requestId : undefined;

  if (code === 'INSUFFICIENT_STOCK') {
    const available =
      typeof (e as any)?.details?.available === 'number'
        ? (e as any).details.available
        : typeof (e as any)?.available === 'number'
          ? (e as any).available
          : undefined;
    return {
      title: 'Estoque insuficiente',
      description:
        typeof available === 'number'
          ? `Disponível agora: ${available}.`
          : 'Não há unidades suficientes para completar a compra.',
      requestId,
      code,
    };
  }

  if (code === 'VALIDATION_ERROR') {
    return {
      title: 'Entrada inválida',
      description: 'Confira o produto e a quantidade informados.',
      requestId,
      code,
    };
  }

  if (code === 'ERP_TEMPORARY') {
    return {
      title: 'Falha temporária no processamento',
      description: 'O ERP está instável. Tente novamente em alguns segundos.',
      requestId,
      code,
    };
  }

  return {
    title: 'Falha técnica',
    description: 'Algo deu errado. Tente novamente.',
    requestId,
    code,
  };
}

