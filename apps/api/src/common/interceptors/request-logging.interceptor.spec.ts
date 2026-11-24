import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

function contextFor(originalUrl: string, type = 'http'): ExecutionContext {
  return {
    getType: () => type,
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', originalUrl, url: originalUrl }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;
}

const handler: CallHandler = { handle: () => of({ ok: true }) };

describe('RequestLoggingInterceptor', () => {
  let interceptor: RequestLoggingInterceptor;
  let debugSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();
    debugSpy = jest.spyOn(Logger.prototype, 'debug');
    warnSpy = jest.spyOn(Logger.prototype, 'warn');
  });

  afterEach(() => jest.restoreAllMocks());

  it('passes the response through untouched', async () => {
    const result = await lastValueFrom(interceptor.intercept(contextFor('/api/v1/blogs'), handler));

    expect(result).toEqual({ ok: true });
  });

  it('logs ordinary requests at debug level only', async () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1040);

    await lastValueFrom(interceptor.intercept(contextFor('/api/v1/blogs'), handler));

    expect(debugSpy).toHaveBeenCalledWith('GET /api/v1/blogs 200 40ms');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('escalates slow requests to a warning', async () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2600);

    await lastValueFrom(interceptor.intercept(contextFor('/api/v1/search'), handler));

    expect(warnSpy).toHaveBeenCalledWith('Slow request: GET /api/v1/search 200 1600ms');
  });

  it('never logs the query string, which can carry OAuth codes', async () => {
    await lastValueFrom(interceptor.intercept(contextFor('/api/v1/auth/google/callback?code=secret-code'), handler));

    expect(JSON.stringify([...debugSpy.mock.calls, ...warnSpy.mock.calls])).not.toContain('secret-code');
  });

  it('skips health checks', async () => {
    await lastValueFrom(interceptor.intercept(contextFor('/health/live'), handler));

    expect(debugSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('ignores non-HTTP contexts such as websockets', async () => {
    await lastValueFrom(interceptor.intercept(contextFor('/socket', 'ws'), handler));

    expect(debugSpy).not.toHaveBeenCalled();
  });
});
