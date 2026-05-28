import {
  requestIdMiddleware,
  REQUEST_ID_HEADER,
} from '@/infra/http/request-id.middleware';

describe('requestIdMiddleware', () => {
  it('propagates incoming request id header', () => {
    const req: any = {
      header: jest.fn().mockReturnValue('incoming-id'),
    };
    const res: any = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('incoming-id');
    expect(res.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'incoming-id',
    );
    expect(next).toHaveBeenCalled();
  });

  it('generates a request id when missing', () => {
    const req: any = {
      header: jest.fn().mockReturnValue(undefined),
    };
    const res: any = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(typeof req.requestId).toBe('string');
    expect(req.requestId).toHaveLength(36);
    expect(res.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      req.requestId,
    );
    expect(next).toHaveBeenCalled();
  });
});
