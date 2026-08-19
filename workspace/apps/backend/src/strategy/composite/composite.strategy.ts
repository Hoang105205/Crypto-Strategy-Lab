import type {
  Candle,
  Signal,
  IStrategy,
  ICombiner,
} from '@crypto-strategy-lab/shared';
import { StrategyType, SignalAction } from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';

export class CompositeStrategy implements IStrategy {
  private readonly name: string;
  private readonly children: IStrategy[];
  private readonly combiner: ICombiner;

  constructor(
    name: string = 'DefaultComposite',
    children: IStrategy[] = [],
    combiner?: ICombiner,
    registry?: StrategyRegistry,
  ) {
    this.name = name;
    this.children = children;
    this.combiner = combiner || {
      combine: (signals: Signal[]) =>
        signals[0] || { action: SignalAction.HOLD, confidence: 0 },
    };
    if (registry && !registry.has(this.name)) {
      registry.register(this);
    }
  }

  getName(): string {
    return this.name;
  }

  getType(): StrategyType {
    return StrategyType.COMPOSITE;
  }

  getParameters(): Record<string, unknown> {
    const combinerType = (this.combiner as any)?.getType?.() || 'MajorityVote';
    const weights = (this.combiner as any)?.getWeights?.();

    return {
      name: this.name,
      childCount: this.children.length,
      childStrategies: this.children.map((c) => c.getName()).join(', '),
      combinerType,
      ...(weights && Object.keys(weights).length > 0 ? { weights } : {}),
    };
  }

  /** Read-only composition boundary used when creating immutable snapshots. */
  getChildren(): readonly IStrategy[] {
    return [...this.children];
  }

  addChild(strategy: IStrategy): void {
    this.children.push(strategy);
  }

  analyze(candles: Candle[]): Signal {
    if (!this.children || this.children.length === 0) {
      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { reason: 'No child strategies configured in composite' },
      };
    }

    const childSignals: Signal[] = this.children.map((child) => {
      const sig = child.analyze(candles);
      return {
        ...sig,
        metadata: {
          ...sig.metadata,
          strategyName: child.getName(),
          strategyType: child.getType(),
        },
      };
    });

    const combinedSignal = this.combiner.combine(childSignals);

    return {
      ...combinedSignal,
      metadata: {
        ...combinedSignal.metadata,
        compositeName: this.name,
        childSignals,
      },
    };
  }

  async analyzeAsync(candles: Candle[]): Promise<Signal> {
    if (!this.children || this.children.length === 0) {
      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { reason: 'No child strategies configured in composite' },
      };
    }

    const childSignalPromises = this.children.map(async (child) => {
      const sig = typeof child.analyzeAsync === 'function'
        ? await child.analyzeAsync(candles)
        : child.analyze(candles);

      return {
        ...sig,
        metadata: {
          ...sig.metadata,
          strategyName: child.getName(),
          strategyType: child.getType(),
        },
      };
    });

    const childSignals: Signal[] = await Promise.all(childSignalPromises);
    const combinedSignal = this.combiner.combine(childSignals);

    return {
      ...combinedSignal,
      metadata: {
        ...combinedSignal.metadata,
        compositeName: this.name,
        childSignals,
      },
    };
  }
}
