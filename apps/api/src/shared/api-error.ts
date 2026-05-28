export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INSUFFICIENT_STOCK'
  | 'ERP_TEMPORARY'
  | 'ERP_PERMANENT'
  | 'TECHNICAL_FAILURE'
  | 'NOT_FOUND';

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  details?: unknown;
};
