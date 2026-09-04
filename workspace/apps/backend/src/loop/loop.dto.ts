import {
  HttpException,
  HttpStatus,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import {
  LoopStatus,
  StrategyGeneratorType,
  type BacktestConfig,
  type SearchLoopConfig,
} from '@crypto-strategy-lab/shared';

export const LoopApiErrorCode = {
  INVALID_LOOP_CONFIG: 'INVALID_LOOP_CONFIG',
  LOOP_ALREADY_ACTIVE: 'LOOP_ALREADY_ACTIVE',
  LOOP_NOT_FOUND: 'LOOP_NOT_FOUND',
  INVALID_LOOP_TRANSITION: 'INVALID_LOOP_TRANSITION',
  STRATEGY_ENGINE_UNAVAILABLE: 'STRATEGY_ENGINE_UNAVAILABLE',
  QUEUE_UNAVAILABLE: 'QUEUE_UNAVAILABLE',
} as const;

export type LoopApiErrorCodeValue =
  (typeof LoopApiErrorCode)[keyof typeof LoopApiErrorCode];

export interface StartLoopRequestDto {
  generatorType: StrategyGeneratorType;
  pair: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  backtestConfig: BacktestConfig;
  maxCandidates?: number;
  maxDurationMs?: number;
  stopOnNoImprovementIterations?: number;
}

export interface LoopCommandResponseDto {
  loopRunId: string;
  status: LoopStatus;
}

export interface LoopErrorResponseDto {
  error: string;
  code: LoopApiErrorCodeValue;
}

const DEFAULT_NO_IMPROVEMENT_LIMIT = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const GENERATOR_TYPES = new Set<string>(Object.values(StrategyGeneratorType));

const ERROR_DEFINITIONS: Readonly<
  Record<LoopApiErrorCodeValue, { status: HttpStatus; message: string }>
> = {
  INVALID_LOOP_CONFIG: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid search loop configuration',
  },
  LOOP_ALREADY_ACTIVE: {
    status: HttpStatus.CONFLICT,
    message: 'A search loop is already active',
  },
  LOOP_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Search loop not found',
  },
  INVALID_LOOP_TRANSITION: {
    status: HttpStatus.CONFLICT,
    message: 'Invalid search loop transition',
  },
  STRATEGY_ENGINE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Strategy Engine is unavailable',
  },
  QUEUE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Queue service is unavailable',
  },
};

@Injectable()
export class StartLoopDtoPipe implements PipeTransform<
  unknown,
  SearchLoopConfig
> {
  transform(value: unknown): SearchLoopConfig {
    try {
      return normalizeStartRequest(value);
    } catch {
      throw loopHttpException(LoopApiErrorCode.INVALID_LOOP_CONFIG);
    }
  }
}

@Injectable()
export class LoopRunIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID_PATTERN.test(value)) {
      throw loopHttpException(LoopApiErrorCode.LOOP_NOT_FOUND);
    }
    return value;
  }
}

export function mapLoopHttpError(
  error: unknown,
  fallback: LoopApiErrorCodeValue = LoopApiErrorCode.STRATEGY_ENGINE_UNAVAILABLE,
): HttpException {
  const code = getKnownErrorCode(error) ?? fallback;
  return loopHttpException(code);
}

export function loopHttpException(code: LoopApiErrorCodeValue): HttpException {
  const definition = ERROR_DEFINITIONS[code];
  const body: LoopErrorResponseDto = {
    error: definition.message,
    code,
  };
  return new HttpException(body, definition.status);
}

function normalizeStartRequest(value: unknown): SearchLoopConfig {
  if (!isRecord(value)) throw new Error('invalid body');

  const generatorType = value.generatorType;
  const pair = normalizeRequiredText(value.pair);
  const timeframe = normalizeRequiredText(value.timeframe);
  const startDate = parseIsoDate(value.startDate);
  const endDate = parseIsoDate(value.endDate);
  const backtestConfig = normalizeBacktestConfig(value.backtestConfig);
  const maxCandidates = normalizeOptionalPositiveInteger(value.maxCandidates);
  const maxDurationMs = normalizeOptionalPositiveInteger(value.maxDurationMs);
  const stopOnNoImprovementIterations =
    value.stopOnNoImprovementIterations === undefined
      ? DEFAULT_NO_IMPROVEMENT_LIMIT
      : requirePositiveInteger(value.stopOnNoImprovementIterations);

  if (
    typeof generatorType !== 'string' ||
    !GENERATOR_TYPES.has(generatorType) ||
    endDate.getTime() <= startDate.getTime()
  ) {
    throw new Error('invalid loop configuration');
  }

  return {
    generatorType: generatorType as StrategyGeneratorType,
    pair,
    timeframe,
    startDate,
    endDate,
    backtestConfig,
    maxCandidates,
    maxDurationMs,
    stopOnNoImprovementIterations,
  };
}

function normalizeBacktestConfig(value: unknown): BacktestConfig {
  if (!isRecord(value)) throw new Error('invalid backtest config');

  const initialCapital = requireFiniteNumber(value.initialCapital);
  const positionSizePercent = requireFiniteNumber(value.positionSizePercent);
  if (
    initialCapital <= 0 ||
    positionSizePercent <= 0 ||
    positionSizePercent > 100
  ) {
    throw new Error('invalid backtest config');
  }

  const commission = normalizeOptionalNonNegativeNumber(value.commission);
  const slippage = normalizeOptionalNonNegativeNumber(value.slippage);
  return {
    initialCapital,
    positionSizePercent,
    ...(commission === undefined ? {} : { commission }),
    ...(slippage === undefined ? {} : { slippage }),
  };
}

function normalizeRequiredText(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('required text');
  }
  return value.trim();
}

function parseIsoDate(value: unknown): Date {
  if (typeof value !== 'string' || !ISO_DATE_TIME_PATTERN.test(value)) {
    throw new Error('invalid ISO date');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('invalid ISO date');
  return parsed;
}

function normalizeOptionalPositiveInteger(value: unknown): number | null {
  return value === undefined ? null : requirePositiveInteger(value);
}

function requirePositiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('expected positive integer');
  }
  return value;
}

function normalizeOptionalNonNegativeNumber(
  value: unknown,
): number | undefined {
  if (value === undefined) return undefined;
  const number = requireFiniteNumber(value);
  if (number < 0) throw new Error('expected non-negative number');
  return number;
}

function requireFiniteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('expected finite number');
  }
  return value;
}

function getKnownErrorCode(error: unknown): LoopApiErrorCodeValue | null {
  if (!isRecord(error) || typeof error.code !== 'string') return null;
  return error.code in ERROR_DEFINITIONS
    ? (error.code as LoopApiErrorCodeValue)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
