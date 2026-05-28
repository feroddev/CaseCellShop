import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '@/shared/api-error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getApiErrorOverrides(details: unknown): {
  code?: ApiErrorBody['code'];
  message?: string;
} {
  if (!isRecord(details)) return {};

  const code = details['code'];
  const message = details['message'];

  return {
    code: typeof code === 'string' ? (code as ApiErrorBody['code']) : undefined,
    message: typeof message === 'string' ? message : undefined,
  };
}

@Catch()
export class HttpExceptionToApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.requestId;
    const isProd = process.env.NODE_ENV === 'production';

    // ValidationPipe throws BadRequestException with a structured response.
    if (exception instanceof BadRequestException) {
      const payload: ApiErrorBody = {
        code: 'VALIDATION_ERROR',
        message: 'Validation error',
        requestId,
        details: isProd ? undefined : exception.getResponse(),
      };

      return response.status(HttpStatus.BAD_REQUEST).json(payload);
    }

    if (exception instanceof ConflictException) {
      const details = exception.getResponse();
      const overrides = getApiErrorOverrides(details);
      const payload: ApiErrorBody = {
        code: overrides.code ?? 'TECHNICAL_FAILURE',
        message: overrides.message ?? 'Conflict',
        requestId,
        details: isProd ? undefined : details,
      };
      return response.status(HttpStatus.CONFLICT).json(payload);
    }

    if (exception instanceof ForbiddenException) {
      const payload: ApiErrorBody = {
        code: 'TECHNICAL_FAILURE',
        message: 'Forbidden',
        requestId,
      };
      return response.status(HttpStatus.FORBIDDEN).json(payload);
    }

    if (exception instanceof NotFoundException) {
      const payload: ApiErrorBody = {
        code: 'NOT_FOUND',
        message: 'Not found',
        requestId,
      };
      return response.status(HttpStatus.NOT_FOUND).json(payload);
    }

    if (exception instanceof ServiceUnavailableException) {
      const details = exception.getResponse();
      const overrides = getApiErrorOverrides(details);
      const payload: ApiErrorBody = {
        code: overrides.code ?? 'TECHNICAL_FAILURE',
        message: overrides.message ?? 'Service unavailable',
        requestId,
        details: isProd ? undefined : details,
      };
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json(payload);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const details = exception.getResponse();

      const payload: ApiErrorBody = {
        code: 'TECHNICAL_FAILURE',
        message: 'Request failed',
        requestId,
        details: isProd ? undefined : details,
      };

      return response.status(status).json(payload);
    }

    const payload: ApiErrorBody = {
      code: 'TECHNICAL_FAILURE',
      message: 'Unexpected error',
      requestId,
    };

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }
}
