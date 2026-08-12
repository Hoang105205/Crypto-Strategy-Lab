import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Candle, Signal, IStrategy, ICombiner } from '@crypto-strategy-lab/shared';
import { StrategyType, SignalAction } from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';

@Injectable()
export class CompositeStrategy implements IStrategy, OnModuleInit {
  private readonly name: string;
  private readonly children: IStrategy[];
  private readonly combiner: ICombiner;

  constructor(
    name: string = 'DefaultComposite',
    children: IStrategy[] = [],
    combiner?: ICombiner,
    private readonly registry?: StrategyRegistry,
  ) {
    this.name = name;
    this.children = children;
    this.combiner = combiner || {
      combine: (signals: Signal[]) => signals[0] || { action: SignalAction.HOLD, confidence: 0 },
    };
  }

  onModuleInit() {
    if (this.registry) {
      this.registry.register(this);
    }
  }

  getName(): string {
    return this.name;
  }

  getType(): StrategyType {
    return StrategyType.COMPOSITE;
  }

  getParameters(): Record<string, unknown> {
    return {
      name: this.name,
      childCount: this.children.length,
      childStrategies: this.children.map((c) => ({ name: c.getName(), type: c.getType() })),
    };
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
}
