import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpExceptionToApiErrorFilter } from '@/infra/http/http-exception.filter';

function createHostMock(overrides?: { requestId?: string }) {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const request = {
    requestId: overrides?.requestId ?? 'req-1',
  };

  const host: ArgumentsHost = {
    switchToHttp: () =>
      ({
        getResponse: () => response,
        getRequest: () => request,
      }) as any,
  } as any;

  return { host, response };
}

describe('HttpExceptionToApiErrorFilter', () => {
  it('maps BadRequestException to VALIDATION_ERROR', () => {
    const filter = new HttpExceptionToApiErrorFilter();
    const { host, response } = createHostMock({ requestId: 'r1' });

    filter.catch(new BadRequestException({ foo: 'bar' }), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Validation error',
        requestId: 'r1',
      }),
    );
  });

  it('maps ConflictException using structured {code,message}', () => {
    const filter = new HttpExceptionToApiErrorFilter();
    const { host, response } = createHostMock();

    filter.catch(
      new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: 'No stock',
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INSUFFICIENT_STOCK',
        message: 'No stock',
      }),
    );
  });

  it('falls back when conflict details are not structured', () => {
    const filter = new HttpExceptionToApiErrorFilter();
    const { host, response } = createHostMock();

    filter.catch(new ConflictException('plain string'), host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TECHNICAL_FAILURE',
        message: 'plain string',
      }),
    );
  });

  it('uses message override when code is missing', () => {
    const filter = new HttpExceptionToApiErrorFilter();
    const { host, response } = createHostMock();

    filter.catch(new ConflictException({ message: 'custom' }), host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TECHNICAL_FAILURE',
        message: 'custom',
      }),
    );
  });

  it('ignores non-string code/message overrides', () => {
    const filter = new HttpExceptionToApiErrorFilter();
    const { host, response } = createHostMock();

    filter.catch(
      new ServiceUnavailableException({
        code: 123,
        message: { nested: true },
      } as any),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TECHNICAL_FAILURE',
        message: 'Service unavailable',
      }),
    );
  });

  it('maps ServiceUnavailableException using structured {code,message}', () => {
    const filter = new HttpExceptionToApiErrorFilter();
    const { host, response } = createHostMock();

    filter.catch(
      new ServiceUnavailableException({
        code: 'ERP_TEMPORARY',
        message: 'ERP down',
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ERP_TEMPORARY',
        message: 'ERP down',
      }),
    );
  });

  it('maps NotFoundException to NOT_FOUND', () => {
    const filter = new HttpExceptionToApiErrorFilter();
    const { host, response } = createHostMock({ requestId: 'r2' });

    filter.catch(new NotFoundException(), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'Not found',
        requestId: 'r2',
      }),
    );
  });

  it('maps generic HttpException to TECHNICAL_FAILURE with status', () => {
    const filter = new HttpExceptionToApiErrorFilter();
    const { host, response } = createHostMock();

    filter.catch(new HttpException({ foo: 'bar' }, 418), host);

    expect(response.status).toHaveBeenCalledWith(418);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TECHNICAL_FAILURE',
        message: 'Request failed',
      }),
    );
  });

  it('maps unknown errors to TECHNICAL_FAILURE (500)', () => {
    const filter = new HttpExceptionToApiErrorFilter();
    const { host, response } = createHostMock();

    filter.catch(new Error('nope'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TECHNICAL_FAILURE',
        message: 'Unexpected error',
      }),
    );
  });
});
