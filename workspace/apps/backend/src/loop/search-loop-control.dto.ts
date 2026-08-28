import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { StrategyGeneratorType } from '@crypto-strategy-lab/shared';
import type { SearchLoopAutomationConfig } from './search-loop-control.repository';

const GENERATOR_TYPES = new Set<string>(Object.values(StrategyGeneratorType));

@Injectable()
export class SearchLoopAutomationConfigPipe implements PipeTransform<
  unknown,
  SearchLoopAutomationConfig
> {
  transform(value: unknown): SearchLoopAutomationConfig {
    try {
      return normalizeAutomationConfig(value);
    } catch {
      throw new BadRequestException({
        error: 'Invalid search loop automation configuration',
        code: 'INVALID_LOOP_AUTOMATION_CONFIG',
      });
    }
  }
}

function normalizeAutomationConfig(value: unknown): SearchLoopAutomationConfig {
  if (!isRecord(value)) throw new Error('invalid body');

  const generatorType = value.generatorType;
  if (
    typeof generatorType !== 'string' ||
    !GENERATOR_TYPES.has(generatorType)
  ) {
    throw new Error('invalid generator type');
  }

  return {
    generatorType: generatorType as StrategyGeneratorType,
    pair: requiredText(value.pair),
    timeframe: requiredText(value.timeframe),
    backtestWindowDays: positiveInteger(value.backtestWindowDays, 180),
    backtestConfig: normalizeBacktestConfig(value.backtestConfig),
    maxCandidatesPerRun: nullablePositiveInteger(
      value.maxCandidatesPerRun,
      100,
    ),
    maxDurationMsPerRun: nullablePositiveInteger(
      value.maxDurationMsPerRun,
      null,
    ),
    stopOnNoImprovementIterations: positiveInteger(
      value.stopOnNoImprovementIterations,
      50,
    ),
    cooldownMs: positiveInteger(value.cooldownMs, 30_000),
  };
}

function normalizeBacktestConfig(value: unknown) {
  if (!isRecord(value)) throw new Error('invalid backtest config');
  const initialCapital = finiteNumber(value.initialCapital);
  const positionSizePercent = finiteNumber(value.positionSizePercent);
  if (
    initialCapital <= 0 ||
    positionSizePercent <= 0 ||
    positionSizePercent > 100
  ) {
    throw new Error('invalid backtest config');
  }

  const commission = optionalNonNegativeNumber(value.commission);
  const slippage = optionalNonNegativeNumber(value.slippage);
  return {
    initialCapital,
    positionSizePercent,
    ...(commission === undefined ? {} : { commission }),
    ...(slippage === undefined ? {} : { slippage }),
  };
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('required text');
  }
  return value.trim();
}

function positiveInteger(value: unknown, fallback: number): number {
  const resolved = value === undefined ? fallback : value;
  if (
    typeof resolved !== 'number' ||
    !Number.isSafeInteger(resolved) ||
    resolved <= 0
  ) {
    throw new Error('positive integer required');
  }
  return resolved;
}

function nullablePositiveInteger(
  value: unknown,
  fallback: number | null,
): number | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  return positiveInteger(value, 1);
}

function optionalNonNegativeNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const resolved = finiteNumber(value);
  if (resolved < 0) throw new Error('non-negative number required');
  return resolved;
}

function finiteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('finite number required');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
