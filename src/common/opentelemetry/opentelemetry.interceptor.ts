import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { catchError, finalize, Observable, throwError } from 'rxjs'
import { logger } from '../logger.singleton'
import { OpenTelemetryService } from './opentelemetry.service'

/**
 * OpenTelemetryInterceptor for injecting Span data from incoming HTTP requests.
 * This sets `.span` on the express Request object. It is intended to be used
 * with the `@RequestSpan` decorator.
 */
@Injectable()
export class OpenTelemetryInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()

    const span = OpenTelemetryService.getNewSpan(
      `Inbound HTTP - ${request.method} ${request.route.path}`,
    )

    span.setAttributes({
      'http.method': request.method,
      'http.path': request.route?.path,
      'http.url': request.url,
      'http.version': request.httpVersion,
    })

    request.span = span
    return next.handle().pipe(
      catchError((err: any) => {
        console.log(`CAUGHT ERROR IN OTEL INTERCEPTOR!`)
        span.setAttribute('error', true)
        span.recordException(err)
        return throwError(() => err)
      }),
      finalize(() => {
        setImmediate(() => {
          span.setAttributes({
            'http.status_code': response.statusCode,
            'http.status_message': response.statusMessage,
            'http.response_content_length': response._contentLength,
          })
          span.end()
        })
      }),
    )
  }
}
