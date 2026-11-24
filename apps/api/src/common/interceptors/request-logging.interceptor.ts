import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SLOW_REQUEST_MS = 1000;
const IGNORED_PATH_PREFIXES = ['/health'];

/**
 * Access logging that stays quiet in production: every request is logged at
 * debug level (hidden in production), and only slow requests surface as
 * warnings. Only the path is logged, never the query string, which can carry
 * OAuth codes and other secrets. Failed requests are logged by the exception
 * filter instead.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const path = (request.originalUrl ?? request.url).split('?')[0];
    if (IGNORED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return next.handle();

    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - startedAt;
        const line = `${request.method} ${path} ${response.statusCode} ${duration}ms`;

        if (duration > SLOW_REQUEST_MS) {
          this.logger.warn(`Slow request: ${line}`);
        } else {
          this.logger.debug(line);
        }
      }),
    );
  }
}
