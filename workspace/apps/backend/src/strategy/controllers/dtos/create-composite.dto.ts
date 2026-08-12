import { CombinerType } from '@crypto-strategy-lab/shared';

export class CreateCompositeDto {
  name: string;
  childStrategyNames: string[];
  combinerType: CombinerType;
  combinerWeights?: Record<string, number>;
}
