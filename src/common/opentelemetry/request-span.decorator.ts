import { Span } from '@opentelemetry/api'
import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common'

export const RequestSpan = createParamDecorator((_, req: ExecutionContext): Span => {
  const span = req.switchToHttp().getRequest().span
  if (!span) {
    throw new InternalServerErrorException(
      'Could not attach span to request!  Did you add the otel interceptor to your controller with @UseInterceptors(OpenTelemetryInterceptor)?',
    )
  }
  return span
})
