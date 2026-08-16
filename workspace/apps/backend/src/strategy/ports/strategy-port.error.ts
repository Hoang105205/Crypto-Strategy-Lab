export type StrategyPortErrorCode =
  | 'JOB_CONFLICT'
  | 'STRATEGY_VERSION_UNSUPPORTED';

export class StrategyPortError extends Error {
  constructor(
    readonly code: StrategyPortErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StrategyPortError';
  }
}
