import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';

export const InfrastructureErrorCode = {
  QUEUE_UNAVAILABLE: 'QUEUE_UNAVAILABLE',
  STRATEGY_ENGINE_UNAVAILABLE: 'STRATEGY_ENGINE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type InfrastructureErrorCodeValue =
  (typeof InfrastructureErrorCode)[keyof typeof InfrastructureErrorCode];

export interface InfrastructureErrorResponse {
  error: string;
  code: string;
}

interface MappedError {
  status: number;
  body: InfrastructureErrorResponse;
}

const DEPENDENCY_ERRORS: Readonly<
  Record<Exclude<InfrastructureErrorCodeValue, 'INTERNAL_ERROR'>, MappedError>
> = {
  QUEUE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    body: {
      error: 'Queue service is unavailable',
      code: InfrastructureErrorCode.QUEUE_UNAVAILABLE,
    },
  },
  STRATEGY_ENGINE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    body: {
      error: 'Strategy Engine is unavailable',
      code: InfrastructureErrorCode.STRATEGY_ENGINE_UNAVAILABLE,
    },
  },
};

const INTERNAL_ERROR: MappedError = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  body: {
    error: 'Internal server error',
    code: InfrastructureErrorCode.INTERNAL_ERROR,
  },
};

@Catch()
export class InfrastructureErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const mapped = mapInfrastructureError(exception);
    const response = host.switchToHttp().getResponse<{
      status(statusCode: number): {
        json(body: InfrastructureErrorResponse): void;
      };
    }>();

    response.status(mapped.status).json(mapped.body);
  }
}

function mapInfrastructureError(exception: unknown): MappedError {
  if (exception instanceof HttpException) {
    const stableBody = stableHttpBody(exception.getResponse());
    if (stableBody) {
      return { status: exception.getStatus(), body: stableBody };
    }
    return INTERNAL_ERROR;
  }

  const code = errorCode(exception);
  if (code && code in DEPENDENCY_ERRORS) {
    return DEPENDENCY_ERRORS[
      code as Exclude<InfrastructureErrorCodeValue, 'INTERNAL_ERROR'>
    ];
  }

  return INTERNAL_ERROR;
}

function stableHttpBody(
  value: string | object,
): InfrastructureErrorResponse | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== 'code' ||
    keys[1] !== 'error' ||
    typeof value.error !== 'string' ||
    value.error.length === 0 ||
    typeof value.code !== 'string' ||
    value.code.length === 0
  ) {
    return null;
  }
  return { error: value.error, code: value.code };
}

function errorCode(value: unknown): string | null {
  return isRecord(value) && typeof value.code === 'string' ? value.code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
