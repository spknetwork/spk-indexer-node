import {
  Exception,
  Span,
  SpanAttributes,
  SpanAttributeValue,
  SpanStatus,
  TimeInput,
  SpanContext,
} from '@opentelemetry/api'

/**
 * Only use this in tests
 */
export class MockSpan implements Span {
  spanContext(): SpanContext {
    return {
      spanId: 'spanId',
      traceFlags: 1,
      traceId: 'traceId',
    }
  }

  setAttribute(key: string, value: SpanAttributeValue): this {
    console.log('mock attribute', key, value)
    return this
  }

  setAttributes(attributes: SpanAttributes): this {
    console.log('mock attributes', attributes)
    return this
  }

  addEvent(
    name: string,
    attributesOrStartTime?: SpanAttributes | TimeInput,
    startTime?: TimeInput,
  ): this {
    console.log('mock event', name, attributesOrStartTime, startTime)
    return this
  }

  setStatus(_status: SpanStatus): this {
    return this
  }

  updateName(_name: string): this {
    return this
  }

  end(_endTime?: TimeInput): void {
    console.log('mock end')
  }

  isRecording(): boolean {
    return true
  }

  recordException(exception: Exception, _time?: TimeInput): void {
    console.log('mock exception', exception)
  }
}
